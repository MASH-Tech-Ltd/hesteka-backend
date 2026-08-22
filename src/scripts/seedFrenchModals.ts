import mongoose from "mongoose";
import dotenv from "dotenv";
import { AppModalModel } from "../modules/appmodal/appmodal.models";
import config from "../config";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(config.mongoUri || "mongodb://127.0.0.1:27017/hesteka");
    console.log("Connected to DB");

    await AppModalModel.findOneAndUpdate(
      { type: "update" },
      {
        title: "Nouvelle version disponible",
        description: "Nous avons ajouté de nouvelles fonctionnalités et améliorations de performances. Veuillez mettre à jour votre application vers la dernière version pour une meilleure expérience."
      }
    );

    await AppModalModel.findOneAndUpdate(
      { type: "region_department" },
      {
        title: "Sélectionnez votre région et département",
        description: "Veuillez confirmer votre région et département actuels pour personnaliser votre tableau de bord et voir les annonces internes pertinentes."
      }
    );

    await AppModalModel.findOneAndUpdate(
      { type: "announcement" },
      {
        title: "Maintenance programmée du système",
        description: "Nous effectuerons une maintenance programmée du serveur dimanche à 02:00 UTC. Certains services pourraient être temporairement indisponibles."
      }
    );

    console.log("Modals updated to French successfully");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
run();
