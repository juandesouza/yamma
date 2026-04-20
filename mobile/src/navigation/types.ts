export type AuthStackParamList = {
  Welcome: undefined;
  Login: { registered?: boolean } | undefined;
  Register: undefined;
};

export type BuyerStackParamList = {
  Home: undefined;
  Profile: undefined;
  Orders: undefined;
  Restaurant: { restaurantId: string };
  Cart: { restaurantId: string };
  Checkout: { restaurantId: string };
  OrderTracking: { orderId: string; restaurantId?: string; clearCartOnEntry?: boolean };
};

export type SellerStackParamList = {
  SellerDashboard: undefined;
  SellerRestaurantProfile: undefined;
};
