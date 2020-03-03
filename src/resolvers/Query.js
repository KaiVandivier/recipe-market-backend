const { forwardTo } = require("prisma-binding");

const Query = {
  user(_, { id }, ctx, info) {
    return ctx.db.query.user({
      where: { id }
    }, info)
  },
  items: forwardTo("db")
};

module.exports = Query;