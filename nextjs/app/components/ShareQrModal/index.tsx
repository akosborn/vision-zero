import { useMemo, useRef, useState } from "react";
import {
  Modal,
  Stack,
  Group,
  Text,
  SegmentedControl,
  Paper,
  Button,
  CopyButton,
} from "@mantine/core";
import { IconCopy, IconCheck, IconDownload } from "@tabler/icons-react";
import { QRCodeCanvas } from "qrcode.react";

type DateMode = "rolling" | "fixed";

interface ShareQrModalProps {
  opened: boolean;
  onClose: () => void;
  baseUrl: string;
}

export default function ShareQrModal({
  opened,
  onClose,
  baseUrl,
}: ShareQrModalProps) {
  const [dateMode, setDateMode] = useState<DateMode>("rolling");
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const shareUrl = useMemo(() => {
    const url = new URL(baseUrl);

    if (dateMode === "rolling") {
      // Relative window: the app should interpret `range=365d` as
      // "365 days before whenever this link is opened", recomputed
      // client-side at load time.
      url.searchParams.delete("start");
      url.searchParams.delete("end");
      url.searchParams.set("range", "365d");
    } else {
      // Fixed snapshot: keep whatever start/end the base URL already has.
      url.searchParams.delete("range");
    }

    return url.toString();
  }, [baseUrl, dateMode]);

  const getQrCanvas = (): HTMLCanvasElement | null =>
    qrWrapperRef.current?.querySelector("canvas") ?? null;

  const handleDownloadQr = () => {
    const canvas = getQrCanvas();
    if (!canvas) {
      return;
    }
    triggerDownload(canvas.toDataURL("image/png"), "crash-report-qr.png");
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Share QR code" size="sm">
      <Stack gap="md">
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Link updates as
          </Text>
          <SegmentedControl
            value={dateMode}
            onChange={(value) => setDateMode(value as DateMode)}
            data={[
              { label: "Rolling 12 months", value: "rolling" },
              { label: "Fixed dates", value: "fixed" },
            ]}
            fullWidth
          />
        </Stack>

        <Paper withBorder radius="md" p="md">
          <Group align="center" wrap="nowrap" gap="md">
            <div ref={qrWrapperRef}>
              <QRCodeCanvas value={shareUrl} size={112} level="M" />
            </div>
            <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
              <Text size="sm" c="dimmed">
                Short link
              </Text>
              <Text size="sm" fw={500} style={{ wordBreak: "break-all" }}>
                {shareUrl}
              </Text>
              <CopyButton value={shareUrl} timeout={1500}>
                {({ copied, copy }) => (
                  <Button
                    size="xs"
                    variant="default"
                    onClick={copy}
                    leftSection={
                      copied ? <IconCheck size={14} /> : <IconCopy size={14} />
                    }
                  >
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                )}
              </CopyButton>
            </Stack>
          </Group>
        </Paper>

        <Button
          variant="default"
          fullWidth
          leftSection={<IconDownload size={16} />}
          onClick={handleDownloadQr}
        >
          Download QR code
        </Button>
      </Stack>
    </Modal>
  );
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
