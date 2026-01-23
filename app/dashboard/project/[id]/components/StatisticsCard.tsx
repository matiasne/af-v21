"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";

export function StatisticsCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <h3 className="text-lg font-semibold">Statistics</h3>
      </CardHeader>
      <Divider />
      <CardBody>
        <p className="text-default-500">
          Project statistics and analytics will be displayed here.
        </p>
      </CardBody>
    </Card>
  );
}
