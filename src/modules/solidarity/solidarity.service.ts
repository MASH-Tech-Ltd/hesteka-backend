import shopify from "../../utils/shopifyClient";
import {
  ShopifyCollection,
  ShopifyProduct,
  SolidarityProduct,
  ShopifyCustomer,
} from "./solidarity.interface";

export const solidarityService = {
  async getProducts(query: { collectionId?: string | undefined; limit?: number | undefined; pageInfo?: string | undefined } = {}): Promise<{ products: SolidarityProduct[], pageInfo: { next?: string, prev?: string } }> {
    const params: any = { limit: query.limit || 50 };
    if (query.collectionId) params.collection_id = query.collectionId;
    if (query.pageInfo) params.page_info = query.pageInfo;
    
    const response = await shopify.get<{ products: ShopifyProduct[] }>("products.json", { params });

    const products = response.data.products.map((product) => ({
      ...product,
      productUrl: `https://${process.env.SHOPIFY_STORE_URL}/products/${product.handle}`,
    }));

    // Parse Link header for pagination
    const linkHeader = response.headers["link"];
    const pageInfo: { next?: string; prev?: string } = {};

    if (linkHeader) {
      const links = linkHeader.split(",");
      links.forEach((link: string) => {
        const urlMatch = link.match(/<(.*)>/);
        const relMatch = link.match(/rel="(.*)"/);
        if (urlMatch && relMatch) {
          const urlString = urlMatch[1];
          if (urlString) {
            const url = new URL(urlString);
            const info = url.searchParams.get("page_info");
            if (info) {
              if (relMatch[1] === "next") pageInfo.next = info;
              if (relMatch[1] === "previous") pageInfo.prev = info;
            }
          }
        }
      });
    }

    return { products, pageInfo };
  },

  async getCollections(): Promise<ShopifyCollection[]> {
    const response = await shopify.get<{ custom_collections: ShopifyCollection[] }>(
      "custom_collections.json",
    );

    return response.data.custom_collections;
  },

  async getCustomers(query: { limit?: number | undefined; pageInfo?: string | undefined } = {}): Promise<{ customers: ShopifyCustomer[], pageInfo: { next?: string, prev?: string } }> {
    const params: any = { limit: query.limit || 50 };
    if (query.pageInfo) params.page_info = query.pageInfo;
    
    const response = await shopify.get<{ customers: ShopifyCustomer[] }>("customers.json", { params });
    const customers = response.data.customers;

    const linkHeader = response.headers["link"];
    const pageInfo: { next?: string; prev?: string } = {};

    if (linkHeader) {
      const links = linkHeader.split(",");
      links.forEach((link: string) => {
        const urlMatch = link.match(/<(.*)>/);
        const relMatch = link.match(/rel="(.*)"/);
        if (urlMatch && relMatch) {
          const urlString = urlMatch[1];
          if (urlString) {
            const url = new URL(urlString);
            const info = url.searchParams.get("page_info");
            if (info) {
              if (relMatch[1] === "next") pageInfo.next = info;
              if (relMatch[1] === "previous") pageInfo.prev = info;
            }
          }
        }
      });
    }

    return { customers, pageInfo };
  },
};
