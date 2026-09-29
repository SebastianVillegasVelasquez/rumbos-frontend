import {type BubbleProps, STATUS_COLORS} from "../types/course-props.types.ts";
import {Circle, Group, Text} from "react-konva";
import type Konva from "konva";
import {clampRelative, toDesignSpace, toRelativeSpace} from "../coordinates.ts";

const Bubble = ({x, y, status, draggable, onClick, onDragEnd}: BubbleProps) => {

    const {x: posX, y: posY} = toDesignSpace({x, y});

    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        const relative = toRelativeSpace({x: e.target.x(), y: e.target.y()});
        onDragEnd?.(clampRelative(relative));
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
