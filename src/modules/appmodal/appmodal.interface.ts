export interface IAppModal {
  _id: string;
  type: "update" | "region_department" | "announcement";
  title: string;
  description: string;
  isActive: boolean;
  actionText?: string;
  appstoreLink?: string;
  playstoreLink?: string;
  iosMinVersion?: string;
  androidMinVersion?: string;
  platform?: "ios" | "android" | "all";
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICreateAppModal {
  type: "update" | "region_department" | "announcement";
  title: string;
  description: string;
  isActive?: boolean;
  actionText?: string;
  appstoreLink?: string;
  playstoreLink?: string;
  iosMinVersion?: string;
  androidMinVersion?: string;
  platform?: "ios" | "android" | "all";
}
