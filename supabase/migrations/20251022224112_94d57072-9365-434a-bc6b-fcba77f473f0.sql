-- Create document_folders table
CREATE TABLE public.document_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  parent_folder_id uuid NULL,
  color text DEFAULT '#3B82F6',
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT document_folders_pkey PRIMARY KEY (id),
  CONSTRAINT document_folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT document_folders_parent_folder_id_fkey FOREIGN KEY (parent_folder_id) REFERENCES public.document_folders(id) ON DELETE CASCADE
);

CREATE INDEX idx_document_folders_user_id ON public.document_folders(user_id);
CREATE INDEX idx_document_folders_parent_folder_id ON public.document_folders(parent_folder_id);

-- Create document_folder_items junction table
CREATE TABLE public.document_folder_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL,
  document_id uuid NOT NULL,
  added_at timestamp with time zone DEFAULT now(),
  CONSTRAINT document_folder_items_pkey PRIMARY KEY (id),
  CONSTRAINT document_folder_items_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.document_folders(id) ON DELETE CASCADE,
  CONSTRAINT document_folder_items_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
  CONSTRAINT document_folder_items_unique UNIQUE (folder_id, document_id)
);

CREATE INDEX idx_document_folder_items_folder_id ON public.document_folder_items(folder_id);
CREATE INDEX idx_document_folder_items_document_id ON public.document_folder_items(document_id);

-- Update chat_sessions table
ALTER TABLE public.chat_sessions
ADD COLUMN default_folder_id uuid NULL,
ADD CONSTRAINT chat_sessions_default_folder_id_fkey 
  FOREIGN KEY (default_folder_id) REFERENCES public.document_folders(id) ON DELETE SET NULL;

CREATE INDEX idx_chat_sessions_default_folder_id ON public.chat_sessions(default_folder_id);

-- Enable RLS
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_folder_items ENABLE ROW LEVEL SECURITY;

-- document_folders policies
CREATE POLICY "Users can view their own folders"
  ON public.document_folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own folders"
  ON public.document_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
  ON public.document_folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
  ON public.document_folders FOR DELETE
  USING (auth.uid() = user_id);

-- document_folder_items policies
CREATE POLICY "Users can view items in their folders"
  ON public.document_folder_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.document_folders
      WHERE document_folders.id = document_folder_items.folder_id
      AND document_folders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add items to their folders"
  ON public.document_folder_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_folders
      WHERE document_folders.id = document_folder_items.folder_id
      AND document_folders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in their folders"
  ON public.document_folder_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.document_folders
      WHERE document_folders.id = document_folder_items.folder_id
      AND document_folders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items from their folders"
  ON public.document_folder_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.document_folders
      WHERE document_folders.id = document_folder_items.folder_id
      AND document_folders.user_id = auth.uid()
    )
  );

-- Create recursive folder query function
CREATE OR REPLACE FUNCTION get_folder_documents_recursive(
  p_folder_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  file_name text,
  file_type text,
  type text,
  content_extracted text,
  processing_status text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE folder_tree AS (
    SELECT id, parent_folder_id
    FROM document_folders
    WHERE id = p_folder_id AND user_id = p_user_id
    
    UNION ALL
    
    SELECT df.id, df.parent_folder_id
    FROM document_folders df
    INNER JOIN folder_tree ft ON df.parent_folder_id = ft.id
    WHERE df.user_id = p_user_id
  )
  SELECT DISTINCT
    d.id,
    d.title,
    d.file_name,
    d.file_type,
    d.type,
    d.content_extracted,
    d.processing_status::text
  FROM documents d
  INNER JOIN document_folder_items dfi ON d.id = dfi.document_id
  INNER JOIN folder_tree ft ON dfi.folder_id = ft.id
  WHERE d.user_id = p_user_id
  ORDER BY d.created_at DESC;
END;
$$;