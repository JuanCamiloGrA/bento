import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { Button } from "../../components/Button";
import type { PhotosApi } from "../../api/photos";
import { t } from "../../i18n/dictionary";

export type PhotoUploadButtonProps = {
  api: PhotosApi;
  onUploaded: () => void;
};

export function PhotoUploadButton({ api, onUploaded }: PhotoUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      await api.uploadPhoto(file);
      onUploaded();
    } finally {
      setUploading(false);
      event.currentTarget.value = "";
    }
  }

  return (
    <>
      <input
        accept="image/*,video/*"
        aria-label={t("photos.upload")}
        className="sr-only"
        onChange={onChange}
        ref={inputRef}
        type="file"
      />
      <Button disabled={uploading} onClick={() => inputRef.current?.click()} variant="primary">
        {uploading ? t("photos.uploading") : t("photos.upload")}
      </Button>
    </>
  );
}
