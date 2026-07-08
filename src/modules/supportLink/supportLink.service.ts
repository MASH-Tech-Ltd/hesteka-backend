import { supportLinkModel } from "./supportLink.models";

export const supportLinkService = {
  async createOrUpdateLink(link: string) {
    let supportLink = await supportLinkModel.findOne();
    if (supportLink) {
      supportLink.link = link;
      await supportLink.save();
    } else {
      supportLink = await supportLinkModel.create({ link });
    }
    return supportLink;
  },
  
  async getLink() {
    const supportLink = await supportLinkModel.findOne();
    return supportLink;
  }
};
