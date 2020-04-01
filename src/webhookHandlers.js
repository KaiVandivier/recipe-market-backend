async function handleCheckoutSessionCompleted(checkoutSession, db) {
  // destructure some useful values from the checkout session
  const { id, display_items, customer_email } = checkoutSession;
  console.log(checkoutSession);

  // find the relevant customer by email (unused maybe b/c of customer_email?);
  const user = await db.query.user({ where: { email: customer_email } });

  // Transform the relevant items into a new order node (independent of items)
  const orderItems = display_items.map(item => {
    return {
      title: item.custom.name,
      image: item.custom.images[0],
      description: item.custom.description,
      quantity: item.quantity,
      price: item.amount
    };
  });
  
  const orderTotal = orderItems.reduce(
    (sum, { price, quantity }) => sum + price * quantity,
    0
  );
  console.log("order total: ", orderTotal); 

  // create an order in the DB
  const order = await db.mutation.createOrder({
    data: {
      total: orderTotal,
      checkoutSessionId: id,
      items: { create: orderItems },
      user: { connect: { email: customer_email } },
    }
  });
  console.log(order);

  // clear cart for the user
  const batchPayload = await db.mutation.deleteManyCartItems({
    where: { user: { email: customer_email } }
  });
  console.log(`Deleted items: ${batchPayload.count}`)

  return order;
}

module.exports = {
  handleCheckoutSessionCompleted
};
