import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Opportunity Circle API',
      version: '1.0.0',
      description: 'API documentation for Opportunity Circle SaaS',
    },
    servers: [
      {
        url: process.env.BACKEND_URL || 'http://localhost:5000',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/api/*.js', './src/models/*.js'], // Path to the API docs and models
};

const specs = swaggerJsdoc(options);

export { specs, swaggerUi };
