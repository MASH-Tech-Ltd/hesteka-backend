import { userModel } from "../usersAuth/user.models";
import { authProvider, role } from "../usersAuth/user.interface";

import { paginationHelper } from "../../utils/pagination";

export const intigrationService = {
  getShopifyUsersEmails: async (query: any = {}) => {
    const { page, limit, skip } = paginationHelper(query.page as string, query.limit as string);

    const filter = {
      provider: { $in: [authProvider.LOCAL, authProvider.GOOGLE] }, 
      role: { $ne: role.ADMIN }
    };

    const total = await userModel.countDocuments(filter);
    
    const users = await userModel.find(filter)
      .select("email -_id")
      .skip(skip)
      .limit(limit);

    return {
      data: users.map(u => ({ email: u.email })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
};
