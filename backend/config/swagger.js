const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "HackHive Meeting Scheduler API",
      version: "1.0.0",
      description: "Comprehensive API documentation for the HackHive meeting scheduling platform.",
      contact: {
        name: "Antigravity AI Support",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // Success Response Template
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operation successful" },
            data: { type: "object", example: { id: "123", status: "active" } },
          },
        },
        // Error Response Template
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Error occurred" },
            error: { type: "string", example: "Invalid input provided" },
          },
        },
        // User Schema
        User: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            role: { type: "string", enum: ["user", "admin"] },
            timezone: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // Meeting Schema
        Meeting: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            organizer: { type: "string" },
            participants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  user: { type: "string" },
                  rsvp: { type: "string", enum: ["pending", "accepted", "declined"] },
                },
              },
            },
            startTime: { type: "string", format: "date-time" },
            endTime: { type: "string", format: "date-time" },
            status: { type: "string", enum: ["scheduled", "cancelled", "completed"] },
            meetingLink: { type: "string" },
          },
        },
        // TimeSlot Schema
        TimeSlot: {
          type: "object",
          properties: {
            _id: { type: "string" },
            host: { type: "string" },
            startTime: { type: "string", format: "date-time" },
            endTime: { type: "string", format: "date-time" },
            isBooked: { type: "boolean" },
          },
        },
      },
      responses: {
        BadRequest: {
          description: "Bad Request",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        Unauthorized: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        Forbidden: {
          description: "Forbidden",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        NotFound: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Paths to files containing OpenAPI annotations
  apis: ["./routes/*.js", "./models/*.js"],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
