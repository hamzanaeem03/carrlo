import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    organizationId?: string;
    organizationName?: string;
  }

  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      organizationId?: string;
      organizationName?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    organizationId?: string;
    organizationName?: string;
  }
}
