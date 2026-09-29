import {type BubbleProps, DESIGN_HEIGHT, DESIGN_WIDTH, STATUS_COLORS} from "../types/course-props.types.ts";
import {Circle, Group, Text} from "react-konva";
import type Konva from "konva";

const Bubble = ({x, y, status, draggable, onClick, onDragEnd}: BubbleProps) => {

    const posX = x * DESIGN_WIDTH;
    const posY = y * DESIGN_HEIGHT;

    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        onDragEnd?.({
            x: e.target.x() / DESIGN_WIDTH,
            y: e.target.y() / DESIGN_HEIGHT,
        });
    };

    return (
        <Group
            x={posX}
            y={posY}
            draggable={draggable}
            onClick={onClick}
            onTap={onClick}
            onDragEnd={handleDragEnd}
        >
            <Circle radius={30} fill={STATUS_COLORS[status]} stroke="white" strokeWidth={3}/>
            <Text
                text="?"
                fontSize={24}
                fill="white"
                width={60}
                height={60}
                offsetX={30}
                offsetY={30}
                align="center"
                verticalAlign="middle"
            />
        </Group>
    );
};
export default Bubble
