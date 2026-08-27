"use client";

import React from "react";
import { Button, Flex, Paper, Text } from "@mantine/core";

type Props = {
  isDrawing: boolean;
  vertexCount: number;
  canApply: boolean;
  isLoading: boolean;
  onStart: () => void;
  onUndo: () => void;
  onClear: () => void;
  onCancel: () => void;
  onApply: () => void;
};

const RouteDrawingControls: React.FC<Props> = ({
  isDrawing,
  vertexCount,
  canApply,
  isLoading,
  onStart,
  onUndo,
  onClear,
  onCancel,
  onApply,
}) => (
  <Paper shadow="sm" radius="md" p="xs" aria-label="Route drawing controls">
    {!isDrawing ? (
      <Button disabled={isLoading} onClick={onStart}>
        Start Drawing
      </Button>
    ) : (
      <Flex gap="xs" align="center" wrap="wrap">
        <Text size="sm" role="status" aria-live="polite">
          Click or tap the map to add vertices. {vertexCount}{" "}
          {vertexCount === 1 ? "vertex" : "vertices"}
        </Text>
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
        <Button
          variant="default"
          size="xs"
          disabled={isLoading}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button size="xs" disabled={isLoading || !canApply} onClick={onApply}>
          Apply
        </Button>
      </Flex>
    )}
  </Paper>
);

export default RouteDrawingControls;
