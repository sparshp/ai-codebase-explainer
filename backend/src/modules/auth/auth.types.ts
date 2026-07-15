export interface JWTPayload {
  userId: string
  email:  string
  iat?:   number
  exp?:   number
}

export interface AuthTokens {
  accessToken:  string
  refreshToken: string
}

export interface RegisterBody {
  email:    string
  password: string
}

export interface LoginBody {
  email:    string
  password: string
}