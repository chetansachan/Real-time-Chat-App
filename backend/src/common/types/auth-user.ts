export interface AuthUser {
  id: string;
  username: string;
}

export interface SocketUser extends AuthUser {
  /** Unix seconds taken from the access token. Sockets can outlive it. */
  exp: number;
}
