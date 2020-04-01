const { forwardTo } = require("prisma-binding");
const { checkPermissions } = require("../utils");

const Query = {
  item: forwardTo("db"),
  items: forwardTo("db"),
  itemsConnection: forwardTo("db"),
  recipe: forwardTo("db"),
  recipes: forwardTo("db"),
  recipesConnection: forwardTo("db"),
  order: forwardTo("db"),
  orders: forwardTo("db"),
  ordersConnection: forwardTo("db"),
  user(_, { id }, ctx, info) {
    return ctx.db.query.user({
      where: { id }
    }, info)
  },
  async currentUser(_, args, ctx, info) {
    if (!ctx.request.userId) return null;
    const user = await ctx.db.query.user({
      where: { id: ctx.request.userId }
    }, info);
    return user;
  },
  async users(_, args, ctx, info) {
    // Check if user is logged in
    if (!ctx.request.userId) throw new Error("You must be logged in");
    // Check for correct permissions
    checkPermissions(ctx.request.user, ["ADMIN", "PERMISSION_UPDATE"]);
    // If all good, query users!
    return ctx.db.query.users({}, info);
  }
};

module.exports = Query;