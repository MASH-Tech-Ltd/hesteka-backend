import { userModel } from "../usersAuth/user.models";
import { authProvider } from "../usersAuth/user.interface";

export const intigrationService = {
  getShopifyUsersEmails: async () => {
    const users = await userModel.find({
      provider: { $in: [authProvider.LOCAL, authProvider.GOOGLE] },
    }).select("email -_id");

    return users.map(u => ({
      email: u.email
    }));
  }
};
