
const Query = {
  description(_, args, ctx, info) {
    return "Hello!"
  },
  user(_, { id }, ctx, info) {
    return ctx.db.query.user({
      where: { id }
    }, info)
  }
};

module.exports = Query;