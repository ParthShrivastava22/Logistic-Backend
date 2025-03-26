# User Registration Endpoint Documentation

## Endpoint: `/user/register`

### Method: POST

### Description:

This endpoint is used to register a new user. The user must provide either an email or a phone number along with other required details.

### Request Body:

The request body should be in JSON format and include the following fields:

- `fullname`: An object containing:
  - `firstname` (string, required): The first name of the user. Must be at least 3 characters long.
  - `lastname` (string, optional): The last name of the user. Must be at least 3 characters long if provided.
- `email` (string, optional): The email address of the user. Must be a valid email format.
- `phone` (string, optional): The phone number of the user. Must be a valid 10-digit phone number.
- `password` (string, required): The password for the user account. Must be at least 6 characters long.

### Example Request Body:

```json
{
  "fullname": {
    "firstname": "John",
    "lastname": "Doe"
  },
  "email": "john.doe@example.com",
  "phone": "9876543210"
}
```

# User Login Endpoint Documentation

## Endpoint: `/user/login`

### Method: POST

### Description:

This endpoint is used to log in an existing user. The user must provide either an email or a phone number along with the password.

### Request Body:

The request body should be in JSON format and include the following fields:

- `email` (string, optional): The email address of the user. Must be a valid email format.
- `phone` (string, optional): The phone number of the user. Must be a valid 10-digit phone number.
- `password` (string, required): The password for the user account. Must be at least 6 characters long.

### Example Request Body:

```json
{
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```

```json
{
  "phone": "9876543210",
  "password": "securePassword123"
}
```

# User Profile Endpoint Documentation

## Endpoint: `/user/profile`

### Method: GET

### Description:

This endpoint retrieves the profile information of the currently authenticated user. It requires a valid authentication token.

### Authentication:

Requires a valid JWT token in either:

- Cookie named "token"
- Authorization header as "Bearer <token>"

### Response Body:

Returns the user object containing profile information.

# User Logout Endpoint Documentation

## Endpoint: `/user/logout`

### Method: GET

### Description:

This endpoint logs out the currently authenticated user by invalidating their token and clearing the authentication cookie.

### Authentication:

Requires a valid JWT token in either:

- Cookie named "token"
- Authorization header as "Bearer <token>"

### Response:

```json
{
  "message": "Logged out"
}
```

The endpoint will:

- Clear the authentication cookie
- Blacklist the current token
- Return a success message
