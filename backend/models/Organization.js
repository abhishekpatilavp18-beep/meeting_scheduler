const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot be more than 500 characters"],
      default: "A newly created workspace for your team.",
    },
    owner: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: ["admin", "member"],
          default: "member",
        },
      },
    ],
    timezone: {
      type: String,
      default: "UTC",
    },
    color: {
      type: String,
      default: "#3b82f6",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Organization", organizationSchema);
