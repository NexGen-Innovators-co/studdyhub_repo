import React from 'react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

export const DocumentCardSkeleton = () => (
  <Card className="animate-pulse">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </CardContent>
  </Card>
);

export const FolderTreeSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-32" />
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-2 pl-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export const DocumentGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <DocumentCardSkeleton key={i} />
    ))}
  </div>
);

export const DocumentListSkeleton = () => (
  <div className="space-y-4">
    {[...Array(6)].map((_, i) => (
      <DocumentCardSkeleton key={i} />
    ))}
  </div>
);
