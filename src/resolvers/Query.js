const { forwardTo } = require("prisma-binding");
const { checkPermissions } = require("../utils");

const Query = {
  item: forwardTo("db"),
  items: forwardTo("db"),
  itemsConnection: forwardTo("db"),
  recipe: forwardTo("db"),
  recipes: forwardTo("db"),
  recipesConnection: forwardTo("db"),
  user(_, { id }, ctx, info) {
    return ctx.db.query.user(
      {
        where: { id }
      },
      info
    );
  },
  async currentUser(_, args, ctx, info) {
    if (!ctx.request.userId) return null;
    const user = await ctx.db.query.user(
      {
        where: { id: ctx.request.userId }
      },
      info
    );
    return user;
  },
  async users(_, args, ctx, info) {
    // Check if user is logged in
    if (!ctx.request.userId) throw new Error("You must be logged in");
    // Check for correct permissions
    checkPermissions(ctx.request.user, ["ADMIN", "PERMISSION_UPDATE"]);
    // If all good, query users!
    return ctx.db.query.users({}, info);
  },
  async myOrders(_, args, ctx, info) {
    // check if user is logged in
    if (!ctx.request.userId) throw new Error("You must be logged in!");
    return ctx.db.query.orders(
      {
        where: {
          user: { id: ctx.request.userId }
        }
      },
      info
    );
  },
  async order(_, { where }, ctx, info) {
    console.log(where);
    // check if user is logged in
    if (!ctx.request.userId) throw new Error("You must be logged in!");
    // get user and order
    const { user } = ctx.request;
    const order = await ctx.db.query.order({ where }, `{ id user { id }}`);
    if (!order) throw new Error(`An order was not found with those query terms.`);
    // check if user has correct privileges
    const permissionsMatched = user.permissions.some(permission =>
      ["ADMIN"].includes(permission)
    );
    const userOwnsOrder = order.user.id === ctx.request.userId;
    if (!userOwnsOrder && !permissionsMatched) throw new Error("Sorry! You don't have permission to do that.");
    // return queried values
    return ctx.db.query.order({ where }, info);
  },
  orders(_, args, ctx, info) {
    // check if user is logged in
    if (!ctx.request.userId) throw new Error("You must be logged in!");
    // check if user has correct privileges
    checkPermissions(ctx.request.user, ["ADMIN"]);
    // query the DB
    return ctx.db.query.orders({ ...args }, info);
  },
  ordersConnection(_, args, ctx, info) {
    // check if user is logged in
    if (!ctx.request.userId) throw new Error("You must be logged in!");
    // check if user has correct privileges
    checkPermissions(ctx.request.user, ["ADMIN"]);
    // query the DB
    return ctx.db.query.orders({ ...args }, info);
  }
};

module.exports = Query;
