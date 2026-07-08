import { donationModel } from "./donation.models";
import { paymentService } from "../payment/payment.service";
import {
  CreateDonationPayload,
  DonationType,
  IDonation,
} from "./donation.interface";
import {
  IPayment,
  PaymentCurrency,
  PaymentProvider,
} from "../payment/payment.interface";
import CustomError from "../../helpers/CustomError";
import mongoose, { Types } from "mongoose";
import PDFDocument from "pdfkit";
import { mailer } from "../../helpers/nodeMailer";
import { any } from "zod";
import { paymentModel } from "../payment/payment.models";

const generateReceiptId = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

// Stripe এর webhook থেকে call হবে
// const createDonationFromPayment = async (
//   payment: IPayment,
// ): Promise<IDonation> => {
//   const existing = await donationModel.findOne({ payment: payment._id });
//   if (existing) return existing;

//   const donationData: any = {
//     payment: payment._id,
//     amount: payment.amount,
//     method: payment.provider, // stripe or paypal
//     status: payment.status === "completed" ? "completed" : "pending",
//     type: payment.metadata?.donationType ?? DonationType.ONE_TIME,
//     donorEmail: payment.payerEmail,
//     donorName: payment.payerName,
//     isCompanyDonation: payment.metadata?.isCompanyDonation ?? false,
//   };

//   if (payment.metadata?.companyInfo) {
//     donationData.companyInfo = payment.metadata.companyInfo;
//   }

//   donationData.receiptId = generateReceiptId();
//   const donation = await donationModel.create(donationData);

//   return donation;
// };

// Stripe donation শুরু করা
const initiateStripeDonation = async (
  payload: CreateDonationPayload,
): Promise<{ clientSecret: string; paymentIntentId: string }> => {
  const {
    amount,
    donorEmail,
    donorName,
    type,
    isCompanyDonation,
    companyInfo,
    userId,
  } = payload;

  // 1️⃣ create payment intent + payment PENDING
  const result = await paymentService.createStripePaymentIntent({
    amount,
    currency: PaymentCurrency.EUR,
    payerEmail: donorEmail,
    payerName: donorName,
    userId,
  } as any);

  // 2️⃣ payment fetch
  const payment = await paymentModel.findOne({
    providerTransactionId: result.paymentIntentId,
  });

  if (!payment) {
    throw new CustomError(404, "Payment not found");
  }

  // 3️⃣ donation create (PENDING)
  const donationData: any = {
    payment: payment._id,
    amount,
    type,
    donorEmail,
    donorName,
    isCompanyDonation: isCompanyDonation ?? false,
  };

  if (companyInfo) {
    donationData.companyInfo = companyInfo;
  }

  await donationModel.create(donationData);

  return result;
};
// PayPal donation শুরু করা
// ✅ PENDING donation এখনই create
const initiatePayPalDonation = async (
  payload: CreateDonationPayload,
): Promise<{ orderId: string }> => {
  const {
    amount,
    donorEmail,
    donorName,
    type,
    isCompanyDonation,
    companyInfo,
    userId,
  } = payload;

  // 1️⃣ PayPal order create + PENDING payment create
  const result = await paymentService.createPayPalOrder({
    amount: amount as number,
    currency: (payload as any).currency || PaymentCurrency.EUR, // Default to EUR as per client requirement
    payerEmail: donorEmail as string,
    payerName: donorName as string,
    userId: userId as string,
  });

  // 2️⃣ payment record fetch (orderId দিয়ে)
  const payment = await paymentModel.findOne({
    providerTransactionId: result.orderId,
  });

  if (!payment) {
    throw new CustomError(404, "Payment record not found after PayPal order");
  }

  // 3️⃣ PENDING donation create
  const donationData: any = {
    payment: payment._id,
    amount,
    method: "paypal",
    status: "pending",
    type: type ?? DonationType.ONE_TIME,
    donorEmail,
    donorName,
    isCompanyDonation: isCompanyDonation ?? false,
    receiptId: generateReceiptId(),
  };

  if (companyInfo) {
    donationData.companyInfo = companyInfo;
  }

  await donationModel.create(donationData);

  return result;
};

// ✅ শুধু PayPal capture call — DB একদম touch করবে না
const capturePayPalDonation = async (payload: {
  orderId: string;
}): Promise<{ captureId: string; orderId: string }> => {
  return await paymentService.capturePayPalOrder({
    orderId: payload.orderId,
    payerEmail: "",
    payerName: "",
  });
};

const syncPhysicalDonation = async (payload: {
  amount: number;
  donorEmail: string;
  donorName: string;
  status: "pending" | "completed" | "cancelled";
  referenceId: string; // ID of the DonationProof
}) => {
  const existing = await donationModel.findOne({
    referenceId: payload.referenceId,
  });
  if (existing) {
    existing.status = payload.status;
    existing.amount = payload.amount;
    await existing.save();
    return existing;
  }

  return await donationModel.create({
    amount: payload.amount,
    method: "collection_point",
    status: payload.status,
    donorEmail: payload.donorEmail,
    donorName: payload.donorName,
    type: DonationType.ONE_TIME,
    referenceId: payload.referenceId,
    receiptId: generateReceiptId(),
    transactionId: generateReceiptId(),
  });
};

const getAllDonations = async (req: any) => {
  const {
    page: pagebody,
    limit: limitbody,
    status,
    method,
    search,
    from,
    to,
    sort,
    sortBy,
  } = req.query;

  const { page, limit, skip } = (
    await import("../../utils/pagination")
  ).paginationHelper(pagebody as string, limitbody as string);

  const filter: any = {};

  if (search) {
    const searchRegex = new RegExp(search as string, "i");
    filter.$or = [{ donorName: searchRegex }, { donorEmail: searchRegex }];
  }

  if (method) {
    filter.method = method;
  } else {
    filter.method = { $ne: "collection_point" };
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from as string);
    if (to) {
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = toDate;
    }
  }

  // get payment populate pipeline
  const pipeline: any[] = [
    {
      $lookup: {
        from: "payments",
        localField: "payment",
        foreignField: "_id",
        as: "payment",
      },
    },
    { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "donationproofs",
        let: { refId: "$referenceId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ["$$refId", null] },
                  { $ne: ["$$refId", ""] },
                  { $eq: ["$_id", { $toObjectId: "$$refId" }] },
                ],
              },
            },
          },
        ],
        as: "proof",
      },
    },
    { $unwind: { path: "$proof", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "partnerads",
        localField: "proof.collectionPoint",
        foreignField: "_id",
        as: "collectionPoint",
      },
    },
    { $unwind: { path: "$collectionPoint", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        method: { $ifNull: ["$method", "$payment.provider"] },
        status: {
          $cond: {
            if: { $and: ["$payment", { $ne: ["$payment", null] }] },
            then: "$payment.status",
            else: "$status",
          },
        },
        association: { $ifNull: ["$collectionPoint.title", "HESTEKA"] },
      },
    },
  ];

  if (status) {
    filter.status = status;
  }

  pipeline.push({ $match: filter });

  const sortFields: Record<string, string> = {
    date: "createdAt",
    amount: "amount",
    donor: "donorName",
  };
  const sortByValue = typeof sortBy === "string" ? sortBy : "date";
  const sortField = sortFields[sortByValue.toLowerCase()] ?? "createdAt";
  const sortOrder = sort === "ascending" ? 1 : -1;

  pipeline.push({ $sort: { [sortField]: sortOrder } });

  const [result] = await donationModel.aggregate([
    {
      $facet: {
        donations: [...pipeline, { $skip: skip }, { $limit: limit }],
        totalCount: [...pipeline, { $count: "count" }],
      },
    },
  ]);

  const donations = result.donations;
  const total = result.totalCount[0]?.count || 0;

  return {
    donations,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getSingleDonation = async (id: string) => {
  const pipeline: any[] = [
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    {
      $lookup: {
        from: "payments",
        localField: "payment",
        foreignField: "_id",
        as: "payment",
      },
    },
    { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "donationproofs",
        let: { refId: "$referenceId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ["$$refId", null] },
                  { $ne: ["$$refId", ""] },
                  { $eq: ["$_id", { $toObjectId: "$$refId" }] },
                ],
              },
            },
          },
        ],
        as: "proof",
      },
    },
    { $unwind: { path: "$proof", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "partnerads",
        localField: "proof.collectionPoint",
        foreignField: "_id",
        as: "collectionPoint",
      },
    },
    { $unwind: { path: "$collectionPoint", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        method: { $ifNull: ["$method", "$payment.provider"] },
        status: {
          $cond: {
            if: { $and: ["$payment", { $ne: ["$payment", null] }] },
            then: "$payment.status",
            else: "$status",
          },
        },
        association: { $ifNull: ["$collectionPoint.title", "HESTEKA"] },
      },
    },
  ];

  const results = await donationModel.aggregate(pipeline);
  const donation = results[0];

  if (!donation) {
    throw new CustomError(404, "Donation not found");
  }

  return donation;
};

const getDonationByReceiptId = async (receiptId: string) => {
  const pipeline: any[] = [
    { $match: { receiptId } },
    {
      $lookup: {
        from: "payments",
        localField: "payment",
        foreignField: "_id",
        as: "payment",
      },
    },
    { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "donationproofs",
        let: { refId: "$referenceId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ["$$refId", null] },
                  { $ne: ["$$refId", ""] },
                  { $eq: ["$_id", { $toObjectId: "$$refId" }] },
                ],
              },
            },
          },
        ],
        as: "proof",
      },
    },
    { $unwind: { path: "$proof", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "partnerads",
        localField: "proof.collectionPoint",
        foreignField: "_id",
        as: "collectionPoint",
      },
    },
    { $unwind: { path: "$collectionPoint", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        method: { $ifNull: ["$method", "$payment.provider"] },
        status: {
          $cond: {
            if: { $and: ["$payment", { $ne: ["$payment", null] }] },
            then: "$payment.status",
            else: "$status",
          },
        },
        association: { $ifNull: ["$collectionPoint.title", "HESTEKA"] },
      },
    },
  ];

  const results = await donationModel.aggregate(pipeline);
  const donation = results[0];

  if (!donation) {
    throw new CustomError(404, "Donation not found");
  }

  return donation;
};

const getMyDonations = async (email: string) => {
  const pipeline: any[] = [
    { $match: { donorEmail: email } },
    {
      $lookup: {
        from: "payments",
        localField: "payment",
        foreignField: "_id",
        as: "payment",
      },
    },
    { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "donationproofs",
        let: { refId: "$referenceId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ["$$refId", null] },
                  { $ne: ["$$refId", ""] },
                  { $eq: ["$_id", { $toObjectId: "$$refId" }] },
                ],
              },
            },
          },
        ],
        as: "proof",
      },
    },
    { $unwind: { path: "$proof", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "partnerads",
        localField: "proof.collectionPoint",
        foreignField: "_id",
        as: "collectionPoint",
      },
    },
    { $unwind: { path: "$collectionPoint", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        method: { $ifNull: ["$method", "$payment.provider"] },
        status: {
          $cond: {
            if: { $and: ["$payment", { $ne: ["$payment", null] }] },
            then: "$payment.status",
            else: "$status",
          },
        },
        association: { $ifNull: ["$collectionPoint.title", "HESTEKA"] },
      },
    },
    { $sort: { createdAt: -1 } }
  ];

  return await donationModel.aggregate(pipeline);
};

export const donationService = {
  initiateStripeDonation,
  initiatePayPalDonation,
  capturePayPalDonation,
  getAllDonations,
  getSingleDonation,
  getDonationByReceiptId,
  getMyDonations,
  syncPhysicalDonation,
  getDonationStats: async () => {
    const [stats] = await donationModel.aggregate([
      {
        $lookup: {
          from: "payments",
          localField: "payment",
          foreignField: "_id",
          as: "paymentInfo",
        },
      },
      { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          realStatus: {
            $cond: {
              if: "$paymentInfo",
              then: "$paymentInfo.status",
              else: "$status",
            },
          },
        },
      },
      {
        $facet: {
          completedStats: [
            { $match: { realStatus: "completed" } },
            {
              $group: {
                _id: null,
                totalCollected: { $sum: "$amount" },
                totalTransactions: { $sum: 1 },
                avgBasket: { $avg: "$amount" },
              },
            },
          ],
          pendingStats: [
            { $match: { realStatus: "pending" } },
            {
              $group: {
                _id: null,
                totalPending: { $sum: "$amount" },
              },
            },
          ],
        },
      },
    ]);

    const completed = stats.completedStats[0] || {
      totalCollected: 0,
      totalTransactions: 0,
      avgBasket: 0,
    };
    const pending = stats.pendingStats[0] || { totalPending: 0 };

    return {
      totalTransactions: completed.totalTransactions,
      totalCollected: completed.totalCollected,
      returnedToAssos: completed.totalCollected * 0.9,
      pendingAmount: pending.totalPending,
      averageBasket: completed.avgBasket
        ? Math.round(completed.avgBasket * 100) / 100
        : 0,
    };
  },

  sendReceiptEmail: async (donationId: string, isFiscal: boolean) => {
    const donation = await donationService.getSingleDonation(donationId);
    if (!donation) throw new CustomError(404, "Donation not found");

    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on("data", (chunk) => buffers.push(chunk));

    return new Promise<void>((resolve, reject) => {
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);

          await mailer({
            email: donation.donorEmail,
            subject: isFiscal
              ? "Official Fiscal Receipt - HESTEKA"
              : "Support Receipt - HESTEKA",
            template: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e8ddd0; border-radius: 12px;">
                <h2 style="color: #3a2a1a;">Thank you, ${donation.donorName}!</h2>
                <p>Please find attached your ${isFiscal ? "official fiscal receipt" : "support receipt"} for your contribution of <strong>${donation.amount}€</strong>.</p>
                <p style="font-size: 12px; color: #9a8a7a;">If you have any questions, please contact our support team.</p>
                <hr style="border: none; border-top: 1px dashed #e8ddd0; margin: 20px 0;">
                <p style="font-weight: bold; color: #3a2a1a;">HESTEKA ASSOCIATION</p>
              </div>
            `,
            attachments: [
              {
                filename: `${isFiscal ? "fiscal_" : ""}receipt_${donation._id?.toString().slice(-8)}.pdf`,
                content: pdfBuffer,
              },
            ],
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      // PDF Content Generation
      doc.fontSize(20).text("HESTEKA", { align: "center" });
      doc.fontSize(10).text("ASSOCIATION", { align: "center" }).moveDown(2);

      doc
        .fontSize(16)
        .text(isFiscal ? "OFFICIAL FISCAL RECEIPT" : "DONATION RECEIPT", {
          align: "center",
        })
        .moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke("#e8ddd0").moveDown(2);

      const tableTop = doc.y;
      doc.fontSize(10).fillColor("#9a8a7a").text("DATE:", 50, tableTop);
      doc
        .fillColor("#3a2a1a")
        .text(new Date(donation.createdAt).toLocaleDateString(), 150, tableTop);

      doc.fillColor("#9a8a7a").text("RECEIPT ID:", 50, tableTop + 20);
      doc
        .fillColor("#3a2a1a")
        .text(
          donation.receiptId || donation._id?.toString().toUpperCase(),
          150,
          tableTop + 20,
        );

      doc.fillColor("#9a8a7a").text("DONATOR:", 50, tableTop + 40);
      doc.fillColor("#3a2a1a").text(donation.donorName, 150, tableTop + 40);

      doc.fillColor("#9a8a7a").text("METHOD:", 50, tableTop + 60);
      doc
        .fillColor("#3a2a1a")
        .text(donation.method.toUpperCase(), 150, tableTop + 60);

      doc.fillColor("#9a8a7a").text("STATUS:", 50, tableTop + 80);
      doc
        .fillColor("#3a2a1a")
        .text(donation.status.toUpperCase(), 150, tableTop + 80);

      doc.moveDown(4);
      doc.rect(50, doc.y, 500, 60).fill("#fcfaf7").stroke("#e8ddd0");
      doc
        .fillColor("#3a2a1a")
        .fontSize(12)
        .text("TOTAL AMOUNT", 50, doc.y + 15, { align: "center", width: 500 });
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text(`${donation.amount}€`, 50, doc.y + 5, {
          align: "center",
          width: 500,
        });

      doc.moveDown(6);
      doc
        .fontSize(8)
        .font("Helvetica-Oblique")
        .fillColor("#9a8a7a")
        .text(
          isFiscal
            ? "This fiscal receipt is issued in accordance with current tax laws. It entitles the donor to a tax deduction for their charitable contribution."
            : "Thank you for your generous support. Your contribution helps us continue our mission to help animals in need.",
          { align: "center" },
        );

      doc.end();
    });
  },
  getCollectionPointDonationsCount: async () => {
    const result = await donationModel.aggregate([
      {
        $match: {
          method: "collection_point",
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);
    return result[0]?.total ?? 0;
  },
};
