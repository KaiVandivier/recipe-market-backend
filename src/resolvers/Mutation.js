const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// TODO: Remove console.logs

const Mutation = {
  async createItem(_, args, ctx, info) {
    // TODO: Check if user has permissions to create
    const res = await ctx.db.mutation.createItem({
      data: {
        ...args
      }
    }, info)
    console.log(res);
    return res
  },
  async editItem(_, args, ctx, info) {
    // TODO: Check for permissions?
    const updates = { ...args };
    delete updates.id

    const res = await ctx.db.mutation.updateItem({
      data: updates,
      where: { id: args.id }
    }, info)
    console.log(res);
    return res;
  },
  async deleteItem(_, { id }, ctx, info) {
    const res = await ctx.db.mutation.deleteItem({
      where: { id }
    }, info);
    return res;
  },
  async createUser(_, args, ctx, info) {
    // downcase email
    const email = args.email.toLowerCase()
    // hash password
    const password = await bcrypt.hash(args.password, 10);
    // make mutation on db
    const user = await ctx.db.mutation.createUser({
      data: {
        name: args.name,
        email,
        password,
        permissions: { set: ["USER"] },
      }
    }, info);
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
    const [user] = await ctx.db.query.users({
      where: {
        email
      }
    }, `{ id email password }`);
    if (!user) throw new Error(`No user found for email ${email}`);
    // Compare password using bcrypt
    const passwordMatch = await bcrypt.compare(args.password, user.password)
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
    ctx.request.clearCookie("token");
    return { message: "Signed out successfully. Goodbye!" };
  }
};

module.exports = Mutation;