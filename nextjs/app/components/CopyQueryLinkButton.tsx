"use client";

import { Button, Tooltip } from "@mantine/core";
import React from "react";

import type { QueryDefinitionV1 } from "@/app/lib/query-definition";
import { isCanonicalQueryUrlShareable } from "@/app/lib/query-url";

type Props = {
  query: QueryDefinitionV1 | null;
};

const CopyQueryLinkButton: React.FC<Props> = ({ query }) => {
  const [status, setStatus] = React.useState<"idle" | "copied" | "error">(
    "idle",
  );

  React.useEffect(() => setStatus("idle"), [query]);

  const isShareable =
    query !== null &&
    isCanonicalQueryUrlShareable(
      query,
      typeof window === "undefined" ? "/map" : window.location.pathname,
    );
  const disabledReason = !query
    ? "Run a supported query before copying its link."
    : !isShareable && query.tool === "draw"
      ? "This route has too many points to fit safely in a link."
      : !isShareable
        ? "This query is too long to fit safely in a link."
        : undefined;

  const copyLink = async () => {
    if (!isShareable) {
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  };

  const label =
    status === "copied"
      ? "Link copied"
      : status === "error"
        ? "Copy failed"
        : "Copy query link";

  return (
    <Tooltip label={disabledReason} disabled={!disabledReason}>
      <span>
        <Button
          variant="default"
          disabled={!isShareable}
          title={disabledReason}
          onClick={() => void copyLink()}
          aria-live="polite"
        >
          {label}
        </Button>
      </span>
    </Tooltip>
  );
};

export default CopyQueryLinkButton;
