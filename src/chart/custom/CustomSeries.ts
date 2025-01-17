/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/

import Displayable from 'zrender/src/graphic/Displayable';
import { ImageStyleProps } from 'zrender/src/graphic/Image';
import { PathProps, PathStyleProps } from 'zrender/src/graphic/Path';
import { PatternObject } from 'zrender/src/graphic/Pattern';
import { ZRenderType } from 'zrender/src/zrender';
import { BarGridLayoutOptionForCustomSeries, BarGridLayoutResult } from '../../layout/barGrid';
import {
    BlurScope,
    CallbackDataParams,
    DecalObject,
    Dictionary,
    DimensionLoose,
    ItemStyleOption,
    LabelOption,
    OptionDataValue,
    OrdinalRawValue,
    ParsedValue,
    SeriesDataType,
    SeriesEncodeOptionMixin,
    SeriesOnCalendarOptionMixin,
    SeriesOnCartesianOptionMixin,
    SeriesOnGeoOptionMixin,
    SeriesOnPolarOptionMixin,
    SeriesOnSingleOptionMixin,
    SeriesOption,
    TextCommonOption,
    ZRStyleProps
} from '../../util/types';
import Element, { ElementProps } from 'zrender/src/Element';
import List, { DefaultDataVisual } from '../../data/List';
import GlobalModel from '../../model/Global';
import createListFromArray from '../helper/createListFromArray';
import { makeInner } from '../../util/model';
import { CoordinateSystem } from '../../coord/CoordinateSystem';
import SeriesModel from '../../model/Series';


export interface LooseElementProps extends ElementProps {
    style?: ZRStyleProps;
    shape?: Dictionary<unknown>;
}

export type CustomExtraElementInfo = Dictionary<unknown>;
export const TRANSFORM_PROPS = {
    x: 1,
    y: 1,
    scaleX: 1,
    scaleY: 1,
    originX: 1,
    originY: 1,
    rotation: 1
} as const;
export type TransformProp = keyof typeof TRANSFORM_PROPS;

// Also compat with ec4, where
// `visual('color') visual('borderColor')` is supported.
export const STYLE_VISUAL_TYPE = {
    color: 'fill',
    borderColor: 'stroke'
} as const;
export type StyleVisualProps = keyof typeof STYLE_VISUAL_TYPE;

export const NON_STYLE_VISUAL_PROPS = {
    symbol: 1,
    symbolSize: 1,
    symbolKeepAspect: 1,
    legendIcon: 1,
    visualMeta: 1,
    liftZ: 1,
    decal: 1
} as const;
export type NonStyleVisualProps = keyof typeof NON_STYLE_VISUAL_PROPS;

// Do not declare "Dictionary" in TransitionAnyOption to restrict the type check.
export type TransitionAnyOption = {
    transition?: TransitionAnyProps;
    enterFrom?: Dictionary<unknown>;
    leaveTo?: Dictionary<unknown>;
};
type TransitionAnyProps = string | string[];
type TransitionTransformOption = {
    transition?: ElementRootTransitionProp | ElementRootTransitionProp[];
    enterFrom?: Dictionary<unknown>;
    leaveTo?: Dictionary<unknown>;
};
type ElementRootTransitionProp = TransformProp | 'shape' | 'extra' | 'style';
type ShapeMorphingOption = {
    /**
     * If do shape morphing animation when type is changed.
     * Only available on path.
     */
    morph?: boolean
};

export interface CustomDuringAPI {
    // Usually other props do not need to be changed in animation during.
    setTransform(key: TransformProp, val: unknown): CustomDuringAPI
    getTransform(key: TransformProp): unknown;
    setShape(key: string, val: unknown): CustomDuringAPI;
    getShape(key: string): unknown;
    setStyle(key: string, val: unknown): CustomDuringAPI
    getStyle(key: string): unknown;
    setExtra(key: string, val: unknown): CustomDuringAPI
    getExtra(key: string): unknown
};


export interface CustomBaseElementOption extends Partial<Pick<
    Element, TransformProp | 'silent' | 'ignore' | 'textConfig'
>>, TransitionTransformOption {
    // element type, required.
    type: string;
    id?: string;
    // For animation diff.
    name?: string;
    info?: CustomExtraElementInfo;
    // `false` means remove the textContent.
    textContent?: CustomTextOption | false;
    // `false` means remove the clipPath
    clipPath?: CustomZRPathOption | false;
    // `extra` can be set in any el option for custom prop for annimation duration.
    extra?: TransitionAnyOption;
    // updateDuringAnimation
    during?(params: CustomDuringAPI): void;

    focus?: 'none' | 'self' | 'series' | ArrayLike<number>
    blurScope?: BlurScope
};
export interface CustomDisplayableOption extends CustomBaseElementOption, Partial<Pick<
    Displayable, 'zlevel' | 'z' | 'z2' | 'invisible'
>> {
    style?: ZRStyleProps & TransitionAnyOption;
    // `false` means remove emphasis trigger.
    styleEmphasis?: ZRStyleProps | false;
    emphasis?: CustomDisplayableOptionOnState;
    blur?: CustomDisplayableOptionOnState;
    select?: CustomDisplayableOptionOnState;
}
export interface CustomDisplayableOptionOnState extends Partial<Pick<
    Displayable, TransformProp | 'textConfig' | 'z2'
>> {
    // `false` means remove emphasis trigger.
    style?: (ZRStyleProps & TransitionAnyOption) | false;
}
export interface CustomGroupOption extends CustomBaseElementOption {
    type: 'group';
    width?: number;
    height?: number;
    // @deprecated
    diffChildrenByName?: boolean;
    // Can only set focus, blur on the root element.
    children: Omit<CustomElementOption, 'focus' | 'blurScope'>[];
    $mergeChildren: false | 'byName' | 'byIndex';
}
export interface CustomZRPathOption extends CustomDisplayableOption, ShapeMorphingOption {
    autoBatch?: boolean;
    shape?: PathProps['shape'] & TransitionAnyOption;
    style?: CustomDisplayableOption['style'] & {
        decal?: DecalObject;
        // Only internal usage. Any user specified value will be overwritten.
        __decalPattern?: PatternObject;
    };
}
export interface CustomSVGPathOption extends CustomDisplayableOption, ShapeMorphingOption {
    type: 'path';
    shape?: {
        // SVG Path, like 'M0,0 L0,-20 L70,-1 L70,0 Z'
        pathData?: string;
        // "d" is the alias of `pathData` follows the SVG convention.
        d?: string;
        layout?: 'center' | 'cover';
        x?: number;
        y?: number;
        width?: number;
        height?: number;
    } & TransitionAnyOption;
}
export interface CustomImageOption extends CustomDisplayableOption {
    type: 'image';
    style?: ImageStyleProps & TransitionAnyOption;
    emphasis?: CustomImageOptionOnState;
    blur?: CustomImageOptionOnState;
    select?: CustomImageOptionOnState;
}
export interface CustomImageOptionOnState extends CustomDisplayableOptionOnState {
    style?: ImageStyleProps & TransitionAnyOption;
}
export interface CustomTextOption extends CustomDisplayableOption {
    type: 'text';
}
export type CustomElementOption = CustomZRPathOption | CustomSVGPathOption | CustomImageOption | CustomTextOption;
export type CustomElementOptionOnState = CustomDisplayableOptionOnState | CustomImageOptionOnState;

export interface CustomSeriesRenderItemAPI extends
        CustomSeriesRenderItemCoordinateSystemAPI {

    // Methods from ExtensionAPI.
    // NOTE: Not using Pick<ExtensionAPI> here because we don't want to bundle ExtensionAPI into the d.ts
    getWidth(): number
    getHeight(): number
    getZr(): ZRenderType
    getDevicePixelRatio(): number

    value(dim: DimensionLoose, dataIndexInside?: number): ParsedValue;
    ordinalRawValue(dim: DimensionLoose, dataIndexInside?: number): ParsedValue | OrdinalRawValue;
    style(userProps?: ZRStyleProps, dataIndexInside?: number): ZRStyleProps;
    styleEmphasis(userProps?: ZRStyleProps, dataIndexInside?: number): ZRStyleProps;
    visual<VT extends NonStyleVisualProps | StyleVisualProps>(
        visualType: VT,
        dataIndexInside?: number
    ): VT extends NonStyleVisualProps ? DefaultDataVisual[VT]
        : VT extends StyleVisualProps ? PathStyleProps[typeof STYLE_VISUAL_TYPE[VT]]
        : void;
    barLayout(opt: BarGridLayoutOptionForCustomSeries): BarGridLayoutResult;
    currentSeriesIndices(): number[];
    font(opt: Pick<TextCommonOption, 'fontStyle' | 'fontWeight' | 'fontSize' | 'fontFamily'>): string;
}
export interface CustomSeriesRenderItemParamsCoordSys {
    type: string;
    // And extra params for each coordinate systems.
}
export interface CustomSeriesRenderItemCoordinateSystemAPI {
    coord(
        data: OptionDataValue | OptionDataValue[],
        clamp?: boolean
    ): number[];
    size?(
        dataSize: OptionDataValue | OptionDataValue[],
        dataItem: OptionDataValue | OptionDataValue[]
    ): number | number[];
}

export type WrapEncodeDefRet = Dictionary<number[]>;

export interface CustomSeriesRenderItemParams {
    context: Dictionary<unknown>;
    seriesId: string;
    seriesName: string;
    seriesIndex: number;
    coordSys: CustomSeriesRenderItemParamsCoordSys;
    dataInsideLength: number;
    encode: WrapEncodeDefRet;
}
type CustomSeriesRenderItem = (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI
) => CustomElementOption;

interface CustomSeriesStateOption {
    itemStyle?: ItemStyleOption;
    label?: LabelOption;
}

export interface CustomSeriesOption extends
    SeriesOption<never>,    // don't support StateOption in custom series.
    SeriesEncodeOptionMixin,
    SeriesOnCartesianOptionMixin,
    SeriesOnPolarOptionMixin,
    SeriesOnSingleOptionMixin,
    SeriesOnGeoOptionMixin,
    SeriesOnCalendarOptionMixin {

    type?: 'custom'

    // If set as 'none', do not depends on coord sys.
    coordinateSystem?: string | 'none';

    renderItem?: CustomSeriesRenderItem;

    // Only works on polar and cartesian2d coordinate system.
    clip?: boolean;
}

export interface LegacyCustomSeriesOption extends SeriesOption<CustomSeriesStateOption>, CustomSeriesStateOption {}

export const customInnerStore = makeInner<{
    info: CustomExtraElementInfo;
    customPathData: string;
    customGraphicType: string;
    customImagePath: CustomImageOption['style']['image'];
    // customText: string;
    txConZ2Set: number;
    leaveToProps: ElementProps;
    option: CustomElementOption;
    userDuring: CustomBaseElementOption['during'];
}, Element>();

export default class CustomSeriesModel extends SeriesModel<CustomSeriesOption> {

    static type = 'series.custom';
    readonly type = CustomSeriesModel.type;

    static dependencies = ['grid', 'polar', 'geo', 'singleAxis', 'calendar'];

    // preventAutoZ = true;

    currentZLevel: number;
    currentZ: number;

    static defaultOption: CustomSeriesOption = {
        coordinateSystem: 'cartesian2d', // Can be set as 'none'
        zlevel: 0,
        z: 2,
        legendHoverLink: true,

        // Custom series will not clip by default.
        // Some case will use custom series to draw label
        // For example https://echarts.apache.org/examples/en/editor.html?c=custom-gantt-flight
        clip: false

        // Cartesian coordinate system
        // xAxisIndex: 0,
        // yAxisIndex: 0,

        // Polar coordinate system
        // polarIndex: 0,

        // Geo coordinate system
        // geoIndex: 0,
    };

    optionUpdated() {
        this.currentZLevel = this.get('zlevel', true);
        this.currentZ = this.get('z', true);
    }

    getInitialData(option: CustomSeriesOption, ecModel: GlobalModel): List {
        return createListFromArray(this.getSource(), this);
    }

    getDataParams(dataIndex: number, dataType?: SeriesDataType, el?: Element): CallbackDataParams & {
        info: CustomExtraElementInfo
    } {
        const params = super.getDataParams(dataIndex, dataType) as ReturnType<CustomSeriesModel['getDataParams']>;
        el && (params.info = customInnerStore(el).info);
        return params;
    }
}

export type PrepareCustomInfo = (coordSys: CoordinateSystem) => {
    coordSys: CustomSeriesRenderItemParamsCoordSys;
    api: CustomSeriesRenderItemCoordinateSystemAPI
};
