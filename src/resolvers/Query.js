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
    console.log(ctx.request.userId);
  }
};

module.exports = Query;