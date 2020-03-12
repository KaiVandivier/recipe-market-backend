const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { promisify } = require("util");
const { transport, mailTemplate } = require("../mail");
const { checkPermissions } = require("../utils");

// TODO: Remove console.logs

const Mutation = {
  async createItem(_, args, ctx, info) {
    // TODO: Check if user is logged in, has permissions to create
    if (!ctx.request.userId) throw new Error("You must be logged in to create an item");
    // Check permissions
    checkPermissions(ctx.request.user, ["ADMIN", "ITEM_CREATE"]);
    // Make DB call
    const res = await ctx.db.mutation.createItem(
      {
        data: {
          ...args,
          user: { connect: { id: ctx.request.userId}}
        }
      },
      info
    );
    return res;
  },

  async editItem(_, args, ctx, info) {
    // TODO: Check for permissions?
    const updates = { ...args };
    delete updates.id;

    const res = await ctx.db.mutation.updateItem(
      {
        data: updates,
        where: { id: args.id }
      },
      info
    );
    console.log(res);
    return res;
  },

  async deleteItem(_, { id }, ctx, info) {
    // TODO: Double check permission
    const res = await ctx.db.mutation.deleteItem(
      {
        where: { id }
      },
      info
    );
    return res;
  },

  async createUser(_, args, ctx, info) {
    // downcase email
    const email = args.email.toLowerCase();
    // hash password
    const password = await bcrypt.hash(args.password, 10);
    // make mutation on db
    const user = await ctx.db.mutation.createUser(
      {
        data: {
          name: args.name,
          email,
          password,
          permissions: { set: ["USER"] }
        }
      },
      info
    );
    // Make & sign a jwt for the user; add as cookie
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    // add jwt to cookie on ctx.response.cookies
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000
    });
    return user;
  },

  async signin(_, args, ctx, info) {
    // Downcase email
    const email = args.email.toLowerCase();
    // find user by email
    const user = await ctx.db.query.user(
      {
        where: {
          email
        }
      },
      `{ id email password }`
    );
    if (!user) throw new Error(`No user found for email ${email}`);
    // Compare password using bcrypt
    const passwordMatch = await bcrypt.compare(args.password, user.password);
    // Hit DB to search for email/password combo?
    if (!passwordMatch) throw new Error("Incorrect password.");
    // If successful, sign JWT and set cookie
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000
    });
    // return found user
    return user;
  },

  async signout(_, args, ctx, info) {
    ctx.response.clearCookie("token");
    return { message: "Signed out successfully. Goodbye!" };
  },
  async requestPasswordReset(_, args, ctx, info) {
    // Find user based on email
    const email = args.email.toLowerCase();
    const user = await ctx.db.query.user({ where: { email } });
    if (!user) throw new Error("No user found for that email.");
    // If found, generate a reset token that expires in 1 hour
    const resetToken = (await promisify(randomBytes)(20)).toString("hex");
    const resetTokenExpiry = Date.now() + 60 * 60 * 1000;
    // Use `updateUser` to add new token and expiry
    const res = await ctx.db.mutation.updateUser({
      data: {
        resetToken,
        resetTokenExpiry
      },
      where: {
        id: user.id
      }
    });
    // TODO: Send email w/ link to reset page
    const mailInfo = await transport.sendMail({
      from: "kpvandivier@gmail.com",
      to: user.email,
      subject: "Reset your password",
      html: mailTemplate(`
        Follow this link to reset your password: \n\n
        <a href="${process.env.FRONTEND_URL}/resetPassword?token=${resetToken}">Reset Password Here</a>
      `)
    });
    // Return success message
    return {
      message:
        "Success! An email has been sent with a link to reset your password."
    };
  },

  async resetPassword(_, args, ctx, info) {
    // Check if passwords match?

    // Find user based on reset token and expiry
    const [user] = await ctx.db.query.users({
      where: {
        resetToken: args.resetToken,
        resetTokenExpiry_gte: Date.now()
      }
    });
    if (!user)
      throw new Error("That reset token is either expired or invalid.");
    // Hash new password
    const password = await bcrypt.hash(args.password, 10);
    // If successful, update password and remove resetToken fields
    const newUser = await ctx.db.mutation.updateUser(
      {
        where: {
          id: user.id
        },
        data: {
          password,
          resetToken: null,
          resetTokenExpiry: null
        }
      },
      info
    );
    // Log them in with a JWT and a cookie
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000
    });
    // return the user
    return newUser;
  },

  async updatePermissions(_, args, ctx, info) {
    // Check if user is logged in and has permissions
    if (!ctx.request.userId) throw new Error("You must be logged in to do this.");
    checkPermissions(ctx.request.user, ["ADMIN", "PERMISSION_UPDATE"]);
    // If all is good, hit DB with update
    const user = await ctx.db.mutation.updateUser({
      where: { id: args.id },
      data: { permissions: { set: args.permissions }}
    }, info);
    return user;
  }
};

module.exports = Mutation;
