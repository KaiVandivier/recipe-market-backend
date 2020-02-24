
const Mutation = {
  async createUser(_, { name, email }, ctx, info) {
    const res = await ctx.db.mutation.createUser({
      data: {
        name,
        email
      }
    }, info);
    console.log(res);
    return res;
  }
};

module.exports = Mutation;