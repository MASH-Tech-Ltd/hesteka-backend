export type ShopifyProduct = Record<string, unknown> & {
  handle: string;
};

export type SolidarityProduct = ShopifyProduct & {
  productUrl: string;
};

export type ShopifyCollection = Record<string, unknown>;

export type ShopifyCustomer = Record<string, unknown> & {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  state: string;
  orders_count: number;
  total_spent: string;
  currency: string;
};
