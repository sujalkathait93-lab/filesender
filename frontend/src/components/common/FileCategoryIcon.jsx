import React from 'react';
import {
  File,
  Image as ImageIcon,
  Video,
  Music,
  FileCode,
  FileText,
  Archive,
  Package
} from 'lucide-react';
import { detectFileType } from '../../utils/fileType';

/**
 * FileCategoryIcon Component
 * Primary Responsibility: Render the appropriate category icon based on filename and MIME type.
 */
export function FileCategoryIcon({ fileName, mimeType, size = 18, category: explicitCategory }) {
  const category = explicitCategory || detectFileType(fileName, mimeType).category;

  switch (category) {
    case 'image':
      return <ImageIcon size={size} />;
    case 'video':
      return <Video size={size} />;
    case 'audio':
      return <Music size={size} />;
    case 'text':
      return <FileCode size={size} />;
    case 'pdf':
      return <FileText size={size} />;
    case 'archive':
      return <Archive size={size} />;
    case 'document':
      return <FileText size={size} />;
    case 'app':
      return <Package size={size} />;
    default:
      return <File size={size} />;
  }
}
