import axios from "axios";

export const ululeClient = axios.create({
  baseURL: "https://api.ulule.com/v1/",
  headers: {
    "Content-Type": "application/json",
  },
});

export const getUluleProjectStats = async (projectSlug: string) => {
  const response = await ululeClient.get(`projects/${projectSlug}`);
  return response.data;
};

export const getUluleProjectDonors = async (projectSlug: string, apiKey: string) => {
  const response = await ululeClient.get<{ orders?: any[] }>(`projects/${projectSlug}/orders`, {
    headers: {
      Authorization: `APIKey ${apiKey}`,
    },
  });
  return response.data.orders || [];
};
