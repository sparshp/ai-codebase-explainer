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

export interface AuthUser {
  id:         string
  email:      string
  created_at: string
}

export interface AuthResult extends AuthTokens {
  user: AuthUser
}

export interface RegisterBody {
  email:    string
  password: string
}

export interface LoginBody {
  email:    string
  password: string
}
