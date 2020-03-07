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
    // TODO: Make & sign a jwt for the user; add as cookie
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: 365 * 24 * 60 * 60 * 1000
    });
    // add jwt to cookie on ctx.response.cookies
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000
    });
    return user;
  }
};

module.exports = Mutation;