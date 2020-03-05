// TODO: Remove console.logs

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
  },
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
  }
};

module.exports = Mutation;