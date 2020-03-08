const { forwardTo } = require("prisma-binding");

const Query = {
  user(_, { id }, ctx, info) {
    return ctx.db.query.user({
      where: { id }
    }, info)
  },
  item: forwardTo("db"),
  items: forwardTo("db"),
  itemsConnection: forwardTo("db"),
  async currentUser(_, args, ctx, info) {
    if (!ctx.request.userId) return null;
    const user = await ctx.db.query.user({
      where: { id: ctx.request.userId }
    }, info);
    return user;
  }
};

module.exports = Query;