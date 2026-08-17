import { AppModalModel } from "./appmodal.models";
import { ICreateAppModal } from "./appmodal.interface";
import CustomError from "../../helpers/CustomError";

const getAllModals = async () => {
  return await AppModalModel.find();
};

const updateModal = async (id: string, data: Partial<ICreateAppModal>) => {
  const modal = await AppModalModel.findByIdAndUpdate(id, data, { new: true });
  if (!modal) throw new CustomError(404, "Modal not found");
  return modal;
};

const checkRegionDepartmentModal = async () => {
  const regionDept = await AppModalModel.findOne({
    type: "region_department",
    isActive: true,
  });
  return regionDept || null;
};

const checkAnnouncementModal = async () => {
  const announcement = await AppModalModel.findOne({
    type: "announcement",
    isActive: true,
  });
  return announcement || null;
};

const checkUpdateModal = async (appVersion?: string, platform?: string) => {
  if (appVersion) {
    const update = await AppModalModel.findOne({
      type: "update",
      isActive: true,
    });
    if (update) {
      if (update.platform === "all" || update.platform === platform) {
        let minVersion = null;
        let actionLink = null;

        if (platform === "ios") {
          minVersion = update.iosMinVersion;
          actionLink = update.appstoreLink;
        } else if (platform === "android") {
          minVersion = update.androidMinVersion;
          actionLink = update.playstoreLink;
        }

        if (minVersion) {
          // Simple version comparison (assumes semver e.g., 1.0.0)
          // If appVersion is strictly less than minVersion, return modal
          if (
            appVersion.localeCompare(minVersion, undefined, {
              numeric: true,
              sensitivity: "base",
            }) < 0
          ) {
            // Only send the relevant link and version back to the client
            return {
              _id: update._id,
              type: update.type,
              title: update.title,
              description: update.description,
              isActive: update.isActive,
              actionLink,
              minAppVersion: minVersion,
            };
          }
        }
      }
    }
  }

  return null; // no modal to show
};

// Seeder function to ensure we always have 1 update and 1 announcement doc
const seedModals = async () => {
  const updateModal = await AppModalModel.findOne({ type: "update" });
  if (!updateModal) {
    await AppModalModel.create({
      type: "update",
      title: "Update Required",
      description:
        "A new version of the app is available. Please update to continue.",
      isActive: false,
      iosMinVersion: "1.0.0",
      androidMinVersion: "1.0.0",
      platform: "all",
    });
  }

  const regionDeptModal = await AppModalModel.findOne({
    type: "region_department",
  });
  if (!regionDeptModal) {
    await AppModalModel.create({
      type: "region_department",
      title: "Set Your Region",
      description: "Please set your region and department to continue.",
      isActive: false,
    });
  }

  const announcementModal = await AppModalModel.findOne({
    type: "announcement",
  });
  if (!announcementModal) {
    await AppModalModel.create({
      type: "announcement",
      title: "Important Announcement",
      description: "We have some exciting news for you!",
      isActive: false,
    });
  }
};

export const appmodalService = {
  getAllModals,
  updateModal,
  checkUpdateModal,
  checkRegionDepartmentModal,
  checkAnnouncementModal,
  seedModals,
};
