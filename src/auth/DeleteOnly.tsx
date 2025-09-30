import React from "react";
import { Protected } from "./Protected";
import type { Resource } from "./types";

type Props = React.PropsWithChildren<{
  resource: Resource;
  fallback?: React.ReactNode; // por defecto no muestra nada
}>;

const DeleteOnly: React.FC<Props> = ({ resource, fallback = null, children }) => {
  return (
    <Protected action="delete" resource={resource} fallback={fallback}>
      {children}
    </Protected>
  );
};

export default DeleteOnly;
