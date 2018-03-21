const {
  requiresAuth,
  schema: { arrayOf, errorToken, jsonResponse }
} = require('../../../openAPI/helpers');

const activityObjectSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'number',
      description: 'Activity globally-unique ID'
    },
    name: {
      type: 'string',
      description: 'Activity name, unique within an APD'
    },
    description: {
      type: 'string',
      description: 'Activity description'
    },
    goals: arrayOf({
      type: 'object',
      description: 'Activity goal',
      properties: {
        description: {
          type: 'string',
          description: 'Goal description'
        },
        objectives: arrayOf({
          type: 'string',
          description: 'Goal objective'
        })
      }
    })
  }
};

const openAPI = {
  '/activities/{id}/approaches': {
    put: {
      description: 'Set the approaches for a specific activity',
      parameters: [
        {
          name: 'id',
          in: 'path',
          description: 'The ID of the activity to set the approaches for',
          required: true
        }
      ],
      requestBody: {
        description: 'The new approaches',
        required: true,
        content: jsonResponse(
          arrayOf({
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'The description of this approach'
              },
              alternatives: {
                type: 'string',
                description: 'The alternatives considered for this approach'
              },
              explanation: {
                type: 'string',
                description:
                  'An explanation of why this approach was chosen over the alternatives'
              }
            }
          })
        )
      },
      responses: {
        200: {
          description: 'The updated activity',
          content: jsonResponse(activityObjectSchema)
        },
        400: {
          description: 'The approaches are invalid (e.g., not an array)',
          content: errorToken
        },
        404: {
          description:
            'The specified activity was not found, or the user does not have access to it'
        }
      }
    }
  }
};

module.exports = requiresAuth(openAPI);
