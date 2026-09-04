// Form building blocks for the Website editor: labelled inputs, the image
// tile with upload, and the "repeater" used for every list (hours, passes,
// gallery photos…). Styled to sit inside the dashboard's ComponentCard.
import { useState } from "react";
import { Button, Input, Popconfirm, Tooltip, Upload, message } from "antd";
import type { UploadProps } from "antd";
import {
  ArrowDownOutlined, ArrowUpOutlined, CloudUploadOutlined, DeleteOutlined,
  LinkOutlined, PictureOutlined, PlusOutlined,
} from "@ant-design/icons";
import ComponentCard from "../../../components/common/ComponentCard";
import { resolveSiteImage } from "../../Site/siteHelpers";
import { uploadSiteImage } from "../../../services/siteContentService";

type UploadRequestOption = Parameters<NonNullable<UploadProps["customRequest"]>>[0];

export const Section = ComponentCard;

export function Field({
  label, hint, children, className = "",
}: {
  label: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {hint && <span className="text-xs text-gray-400 dark:text-gray-500">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function TextField({
  label, value, onChange, hint, rows, placeholder, className, maxLength,
}: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
  rows?: number; placeholder?: string; className?: string; maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      {rows ? (
        <Input.TextArea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          showCount={!!maxLength}
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} />
      )}
    </Field>
  );
}

function fileLabel(path: string): string {
  const clean = path.split("?")[0];
  return clean.substring(clean.lastIndexOf("/") + 1) || clean;
}

/** Image tile: click to upload, or paste a link. Shows what the site will show. */
export function ImageField({
  label, value, onChange, hint, aspect = "aspect-[16/7]",
}: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; aspect?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const customRequest = async ({ file, onSuccess, onError }: UploadRequestOption) => {
    setUploading(true);
    try {
      const res = await uploadSiteImage(file as File);
      onChange(res.path);
      onSuccess?.(res);
      message.success("Image uploaded");
    } catch (e) {
      const msg = (e as { message?: string })?.message || "Upload failed";
      message.error(msg);
      onError?.(new Error(msg));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field label={label} hint={hint ?? "JPG, PNG or WebP · up to 10 MB"}>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
        <div className="[&_.ant-upload]:block [&_.ant-upload]:w-full">
          <Upload accept="image/*" showUploadList={false} customRequest={customRequest} disabled={uploading}>
            <div className={`group relative w-full cursor-pointer bg-gray-100 dark:bg-gray-800 ${aspect}`}>
              {value ? (
                <img
                  src={resolveSiteImage(value)}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/images/image-placeholder.svg";
                  }}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-400">
                  <PictureOutlined className="text-2xl" />
                  <span className="text-xs">No image yet</span>
                </div>
              )}
              <div
                className={`absolute inset-0 flex items-center justify-center transition ${
                  uploading ? "bg-black/50 opacity-100" : "bg-black/0 opacity-0 group-hover:bg-black/45 group-hover:opacity-100"
                }`}
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-800 shadow">
                  <CloudUploadOutlined />
                  {uploading ? "Uploading…" : value ? "Click to replace" : "Click to upload"}
                </span>
              </div>
            </div>
          </Upload>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-1.5 dark:border-white/10">
          <span className="truncate text-xs text-gray-500 dark:text-gray-400" title={value}>
            {value ? fileLabel(value) : "No image"}
          </span>
          <div className="flex shrink-0 gap-1">
            <Tooltip title="Use an image link instead of uploading">
              <Button size="small" type="text" icon={<LinkOutlined />} onClick={() => setShowLink((s) => !s)}>
                Link
              </Button>
            </Tooltip>
            {value && (
              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onChange("")}>
                Remove
              </Button>
            )}
          </div>
        </div>
        {showLink && (
          <div className="border-t border-gray-100 px-3 py-2 dark:border-white/10">
            <Input
              size="small"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              allowClear
            />
          </div>
        )}
      </div>
    </Field>
  );
}

export function RowTools({
  index, count, onMove, onRemove, confirmText = "Remove this row?",
}: {
  index: number; count: number; onMove: (dir: -1 | 1) => void; onRemove: () => void; confirmText?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Tooltip title="Move up">
        <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => onMove(-1)} />
      </Tooltip>
      <Tooltip title="Move down">
        <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={index === count - 1} onClick={() => onMove(1)} />
      </Tooltip>
      <Popconfirm title={confirmText} okText="Remove" okButtonProps={{ danger: true }} onConfirm={onRemove}>
        <Tooltip title="Remove">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Tooltip>
      </Popconfirm>
    </div>
  );
}

/** Numbered list of editable rows with add / move / remove. */
export function Repeater<T>({
  items, renderRow, onAdd, onMove, onRemove, addLabel, emptyText, rowClassName = "",
  confirmText,
}: {
  items: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  onAdd: () => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
  addLabel: string;
  emptyText: string;
  rowClassName?: string;
  confirmText?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-xl border border-gray-200/80 bg-gray-50/60 p-3 transition-colors hover:border-gray-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 ${rowClassName}`}
        >
          <span className="mt-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">{renderRow(item, i)}</div>
          <RowTools index={i} count={items.length} onMove={(dir) => onMove(i, dir)} onRemove={() => onRemove(i)} confirmText={confirmText} />
        </div>
      ))}
      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400 dark:border-white/15">
          {emptyText}
        </div>
      )}
      <Button icon={<PlusOutlined />} onClick={onAdd} block type="dashed">
        {addLabel}
      </Button>
    </div>
  );
}
