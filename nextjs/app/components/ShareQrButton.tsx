import * as React from "react";
import { Button, Tooltip } from "@mantine/core";
import ShareQrModal from "./ShareQrModal";
import { QueryDefinitionV1 } from "@/app/lib/query-definition";
import { isCanonicalQueryUrlShareable } from "@/app/lib/query-url";

interface Props {
  query: QueryDefinitionV1 | null;
}

const ShareQrButton: React.FC<Props> = ({ query }) => {
  const [modalOpened, setModalOpened] = React.useState(false);

  const isShareable =
    query !== null &&
    isCanonicalQueryUrlShareable(
      query,
      typeof window === "undefined" ? "/map" : window.location.pathname,
    );
  const disabledReason = !query
    ? "Run a supported query before sharing its link."
    : !isShareable && query.tool === "draw"
      ? "This route has too many points to fit safely in a QR code."
      : !isShareable
        ? "This query is too long to fit safely in a QR code."
        : undefined;

  return (
    <>
      <Tooltip label={disabledReason} disabled={!disabledReason}>
        <span>
          <Button
            variant="default"
            disabled={!isShareable}
            title={disabledReason}
            onClick={() => setModalOpened(true)}
          >
            Share QR
          </Button>
        </span>
      </Tooltip>

      {/* Only mounted once shareable, same as the modal has nothing sensible to encode otherwise. */}
      {isShareable && (
        <ShareQrModal
          opened={modalOpened}
          onClose={() => setModalOpened(false)}
          baseUrl={typeof window === "undefined" ? "" : window.location.href}
        />
      )}
    </>
  );
};

export default ShareQrButton;
