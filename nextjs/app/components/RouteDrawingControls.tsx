"use client";

import React from "react";
import { Button, Flex, Text } from "@mantine/core";

type Props = {
  vertexCount: number;
  canApply: boolean;
  canStartNewLine: boolean;
  onNewLine: () => void;
  isLoading: boolean;
  onUndo: () => void;
  onClear: () => void;
  onApply: () => void;
};

const RouteDrawingControls: React.FC<Props> = ({
  vertexCount,
  canApply,
  canStartNewLine,
  onNewLine,
  isLoading,
  onUndo,
  onClear,
  onApply,
}) => (
  <Flex
    gap="xs"
    align="center"
    wrap="wrap"
    role="group"
    aria-label={`Route drawing controls, ${vertexCount} ${
      vertexCount === 1 ? "vertex" : "vertices"
    }`}
  >
    <Text size="sm">Click on map to plot route</Text>
    <Button
      variant="default"
      size="xs"
      disabled={isLoading || !canStartNewLine}
      onClick={onNewLine}
    >
      New line
    </Button>
    <Button
      variant="default"
      size="xs"
      disabled={isLoading || vertexCount === 0}
      onClick={onUndo}
    >
      Undo
    </Button>
    <Button
      variant="default"
      size="xs"
      disabled={isLoading || vertexCount === 0}
      onClick={onClear}
    >
      Clear
    </Button>
    <Button size="xs" disabled={isLoading || !canApply} onClick={onApply}>
      Apply
    </Button>
  </Flex>
);

export default RouteDrawingControls;
