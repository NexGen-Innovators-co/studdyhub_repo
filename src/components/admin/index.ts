import React from "react";

// src/components/admin/index.ts
export const AdminDashboard = React.lazy(() => import("./adminDashboard"));
export const UserManagement = React.lazy(() => import("./UserManagement"));
export const AdminManagement = React.lazy(() => import("./AdminManagement"));
export const ContentModeration = React.lazy(() => import("./ContentModeration"));
export const ActivityLogs = React.lazy(() => import("./ActivityLogs"));