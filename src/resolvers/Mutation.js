const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { promisify } = require("util");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { transport, mailTemplate } = require("../mail");
const { checkPermissions } = require("../utils");

// TODO: Remove console.logs

const Mutation = {
  async createItem(_, args, ctx, info) {
    // Check if user is logged in, has permissions to create
    if (!ctx.request.userId)
      throw new Error("You must be logged in to create an item");
    // Check permissions
    checkPermissions(ctx.request.user, ["ADMIN", "ITEM_CREATE"]);
    // Make DB call
    const res = await ctx.db.mutation.createItem(
      {
        data: {
          ...args,
          user: { connect: { id: ctx.request.userId } }
        }
      },
      info
    );
    return res;
  },

  async editItem(_, args, ctx, info) {
    // Check if user is logged in, has permissions to create
    if (!ctx.request.userId) throw new Error("You must be logged in");
    // Get user and item
    const { user } = ctx.request;
    const item = await ctx.db.query.item(
      { where: { id: args.id } },
      `{ user { id } }`
    );
    // Check permissions
    const permissionsMatched = user.permissions.some(permission =>
      ["ADMIN", "ITEM_UPDATE"].includes(permission)
    );
    const ownsItem = ctx.request.userId === item.user.id;
    if (!permissionsMatched && !ownsItem)
      throw new Error("You don't have permission to edit this item!");

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
    // Check if user is logged in, has permissions to create
    if (!ctx.request.userId) throw new Error("You must be logged in");
    // Get User and item
    const { user } = ctx.request;
    const item = await ctx.db.query.item({ where: { id } }, `{ user { id } }`);
    // Check permissions
    const permissionsMatched = user.permissions.some(permission =>
      ["ADMIN", "ITEM_DELETE"].includes(permission)
    );
    const ownsItem = ctx.request.userId === item.user.id;
    if (!permissionsMatched && !ownsItem)
      throw new Error("You don't have permission to delete this item!");

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
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
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
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
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
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000
    });
    // return the user
    return newUser;
  },

  async updatePermissions(_, args, ctx, info) {
    // Check if user is logged in and has permissions
    if (!ctx.request.userId)
      throw new Error("You must be logged in to do this.");
    checkPermissions(ctx.request.user, ["ADMIN", "PERMISSION_UPDATE"]);
    // If all is good, hit DB with update
    const user = await ctx.db.mutation.updateUser(
      {
        where: { id: args.id },
        data: { permissions: { set: args.permissions } }
      },
      info
    );
    return user;
  },

  async addItemToCart(_, { id, quantity }, ctx, info) {
    // Check if user is logged in
    if (!ctx.request.user) throw new Error("You must be logged in!");
    // Check to see if a cart item already exists for this user and item
    const [existingCartItem] = await ctx.db.query.cartItems({
      where: {
        user: { id: ctx.request.userId },
        item: { id }
      }
    });
    // if the user already has a cart item, increment the quantity
    if (existingCartItem) {
      return ctx.db.mutation.updateCartItem(
        {
          where: { id: existingCartItem.id },
          data: { quantity: existingCartItem.quantity + quantity }
        },
        info
      );
    }

    // If not, Make the CartItem for the user
    return ctx.db.mutation.createCartItem(
      {
        data: {
          quantity,
          item: { connect: { id } },
          user: { connect: { id: ctx.request.userId } }
        }
      },
      info
    );
  },

  async removeFromCart(_, { id }, ctx, info) {
    // Check to see if the user is logged in
    if (!ctx.request.userId)
      throw new Error("You must be logged in to do that!");
    // Check if cart item exists
    const cartItem = await ctx.db.query.cartItem(
      { where: { id } },
      `{ id user { id } }`
    );
    if (!cartItem) throw new Error("That item doesn't exist!");
    // Check if user owns that item
    if (cartItem.user.id !== ctx.request.userId)
      throw new Error("You can't do that!");
    // If all is good, hit DB
    return ctx.db.mutation.deleteCartItem({ where: { id } }, info);
  },

  async createRecipe(_, args, ctx, info) {
    const {
      title,
      description,
      instructions,
      ingredients,
      image,
      largeImage
    } = args;
    // Check if everything is good:
    // User logged in?
    if (!ctx.request.userId) throw new Error("You must be logged in!");
    // Items exist? Maybe this is already handled at other steps
    // Check permissions? TODO: More specific permissions
    checkPermissions(ctx.request.user, ["ADMIN", "ITEM_CREATE"]);
    if (ingredients.length < 1)
      throw new Error("You must add some ingredients to this recipe!");
    // The DB step:
    return ctx.db.mutation.createRecipe(
      {
        data: {
          title,
          description,
          instructions,
          image,
          largeImage,
          user: { connect: { id: ctx.request.userId } },
          ingredients: {
            create: ingredients.map(({ id, quantity }) => ({
              item: { connect: { id } },
              quantity
            }))
          }
        }
      },
      info
    );
  },

  async editRecipe(_, args, ctx, info) {
    // Destructure args
    const {
      id,
      title,
      description,
      instructions,
      ingredients,
      image,
      largeImage
    } = args;

    // User logged in?
    if (!ctx.request.userId) throw new Error("You must be logged in!");

    // Check permissions? TODO: More specific permissions
    checkPermissions(ctx.request.user, ["ADMIN", "ITEM_UPDATE"]);

    // TODO: Validate info: ingredients.length > 1? Anything else?
    if (ingredients.length < 1)
      throw new Error("You must add some ingredients to this recipe!");

    // Query the existing ingredients
    const existingRecipe = await ctx.db.query.recipe(
      { where: { id } },
      `{ ingredients { id } }`
    );
    const deleteInputs = existingRecipe.ingredients.map(({ id }) => ({ id }));

    // The DB step:
    return ctx.db.mutation.updateRecipe(
      {
        where: { id },
        data: {
          title,
          description,
          instructions,
          image,
          largeImage,
          // user: { connect: { id: ctx.request.userId } },
          ingredients: {
            delete: deleteInputs,
            create: ingredients.map(({ id, quantity }) => ({
              item: { connect: { id } },
              quantity
            }))
          }
        }
      },
      info
    );
  },

  async deleteRecipe(_, { id }, ctx, info) {
    // check if user is logged in
    if (!ctx.request.userId)
      throw new Error("You must be logged in to do that!");
    // query recipe
    const recipe = await ctx.db.query.recipe(
      { where: { id } },
      `{ id user { id }}`
    );
    // check if recipe exists
    if (!recipe) throw new Error("Oops, that recipe doesn't exist");
    // check if user has correct permissions
    const userOwnsRecipe = recipe.user.id === ctx.request.userId;
    const userHasPermission = checkPermissions(ctx.request.user, [
      "ADMIN",
      "ITEM_DELETE"
    ]);
    if (!userOwnsRecipe && !userHasPermission)
      throw new Error("You don't have permission to do that!");
    // delete recipeItems
    const deletedItems = await ctx.db.mutation.deleteManyRecipeItems({
      where: { recipe: { id } }
    });
    // delete recipe & return
    return ctx.db.mutation.deleteRecipe({ where: { id } }, info);
  },

  async addRecipeToCart(_, { id, quantity }, ctx, info) {
    // Check if user is logged in
    if (!ctx.request.userId) throw new Error("You must be logged in!");

    // Check if recipe exists
    const recipe = await ctx.db.query.recipe(
      { where: { id } },
      `{ ingredients { id quantity item { id } } }`
    );
    if (!recipe) throw new Error("Uh oh! That recipe doesn't exist");

    // For each recipe ingredient...
    // Is this gonna work with a bunch of returned promises?
    // --> Use `await Promise.all()`
    const newCartItems = await Promise.all(
      recipe.ingredients.map(async ingredient => {
        // TODO: Convert this to `upsert`?
        // Problem: we need to acquire the existing quantity somehow to add it up

        // Check to see if a cart item already exists for this user and item
        const [existingCartItem] = await ctx.db.query.cartItems({
          where: {
            user: { id: ctx.request.userId },
            item: { id: ingredient.item.id }
          }
        });
        // if the user already has a cart item, increment the quantity
        if (existingCartItem) {
          return ctx.db.mutation.updateCartItem(
            {
              where: { id: existingCartItem.id },
              data: {
                quantity:
                  existingCartItem.quantity + ingredient.quantity * quantity
              }
            },
            info
          );
        }
        // If not, Make the CartItem for the user
        return ctx.db.mutation.createCartItem(
          {
            data: {
              quantity: ingredient.quantity * quantity,
              item: { connect: { id: ingredient.item.id } },
              user: { connect: { id: ctx.request.userId } }
            }
          },
          info
        );
        // (Cart item quantity = recipe qty * ingredient qty)
      })
    );
    return newCartItems;
  },

  async checkout(_, args, ctx, info) {
    // Make sure user is logged in
    if (!ctx.request.userId) throw new Error("You must be logged in!");
    // Query the user's cart
    const user = await ctx.db.query.user(
      { where: { id: ctx.request.userId } },
      `{ id email cart { id quantity item { title description image price } } }`
    );
    // Make a list of line items 
    // (note that some object keys are different from our API)
    const lineItems = user.cart.map(({ item, quantity }) => ({
      name: item.title,
      description: item.description,
      images: [item.image],
      amount: item.price,
      currency: "usd",
      // Handle fractional quantities at this point:
      quantity: Math.ceil(quantity)
    }));
    console.log(lineItems);

    // Invoke stripe to make a session
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url:
        `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`
    });
    console.log(session);
    return { sessionId: session.id };
  }
};

module.exports = Mutation;
