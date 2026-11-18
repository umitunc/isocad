import { WeldStampEntity } from '../../core/entities/WeldStampEntity';
import { Point2D, SnapPoint } from '../../core/interfaces/ICadEntity';
import { distancePointToSegment } from '../../core/math/GeometryIntersections';
import { VectorSegment2D } from '../../core/spatial/OsnapEngine';
import { dnToInch, dnVal, parseThk } from '../parsers/MaterialNormalizer';
import { CutItem, MTOItem, PipingPageContext, WeldJoint } from '../types/PipingModels';

interface SeqNode {
  itemNo: string;
  desc: string;
  dan: string;
  sizeDn: string;
  thk: string;
}

export class WeldTopologyBuilder {
  public build(
    page: PipingPageContext,
    mtoItems: MTOItem[],
    cutItems: CutItem[],
    lineNo: string,
    revNo: string,
    startJointNo = 1,
  ): WeldJoint[] {
    const joints: WeldJoint[] = [];
    const pipeItems = mtoItems.filter((m) => m.component === 'PIPE');
    const fittingItems = mtoItems.filter((m) => m.component === 'FITTINGS');
    const valveItems = mtoItems.filter((m) => m.component === 'VALVES');
    if (pipeItems.length === 0) return joints;

    const mainDnV = Math.max(...pipeItems.map((p) => dnVal(p.sizeDn)));
    const mainPipes = pipeItems.filter((p) => dnVal(p.sizeDn) === mainDnV);
    const branchPipes = pipeItems.filter((p) => dnVal(p.sizeDn) < mainDnV);

    const safePieceNo = (c: CutItem) => {
      const n = Number.parseInt(c.pieceNo.replace(/[<>]/g, ''), 10);
      return Number.isNaN(n) ? 0 : n;
    };

    const mainCuts = cutItems
      .filter((c) => dnVal(c.sizeDn) === mainDnV)
      .sort((a, b) => safePieceNo(a) - safePieceNo(b));

    const mainFittings = fittingItems.filter((f) => dnVal(f.sizeDn) === mainDnV);
    const pool = this.expandFittings(mainFittings);
    const elbow45Cuts = this.find45Positions(page.fullText);

    // Find spatial coordinates of numbered weld circles on the drawing area (left 70%)
    const drawingNumbers = page.words
      .filter((w) => w.x0 < page.width * 0.7 && /^\d{1,2}$/.test(w.text.trim()))
      .map((w) => ({
        num: Number.parseInt(w.text.trim(), 10),
        x: (w.x0 + w.x1) * 0.5,
        y: (w.top + w.bottom) * 0.5,
      }));
    const anchorByJoint = new Map<number, { x: number; y: number }>();
    for (const dn of drawingNumbers) {
      if (!anchorByJoint.has(dn.num)) {
        anchorByJoint.set(dn.num, { x: dn.x, y: dn.y });
      }
    }

    let jno = startJointNo;
    if (mainPipes.length > 0 && mainCuts.length > 0) {
      const ref = mainPipes[0];
      const cont: SeqNode = {
        itemNo: '-',
        desc: 'Continuation/Nozzle',
        dan: '-',
        sizeDn: ref.sizeDn,
        thk: parseThk(ref.description),
      };
      const p45 = pool.filter((f) => f.is45);
      const p90 = pool.filter((f) => f.is90 && !f.is45);
      const pRest = pool.filter((f) => !f.is45 && !f.is90);

      const seq: SeqNode[] = [cont];
      for (let i = 0; i < mainCuts.length; i++) {
        const cut = mainCuts[i];
        seq.push({
          itemNo: ref.itemNo,
          desc: ref.description,
          dan: ref.danCode,
          sizeDn: ref.sizeDn,
          thk: parseThk(ref.description),
        });
        if (i < mainCuts.length - 1) {
          const cn = safePieceNo(cut);
          if (elbow45Cuts.has(cn) && p45.length > 0) seq.push(p45.shift()!);
          else if (p90.length > 0) seq.push(p90.shift()!);
          else if (pRest.length > 0) seq.push(pRest.shift()!);
        }
      }
      seq.push(cont);

      for (let i = 0; i < seq.length - 1; i++) {
        joints.push(
          this.createJoint(
            seq[i],
            seq[i + 1],
            lineNo,
            revNo,
            page.sheetNo,
            jno,
            anchorByJoint.get(jno),
          ),
        );
        jno++;
      }
    }

    for (const bp of branchPipes) {
      const bdv = dnVal(bp.sizeDn);
      const bFits = fittingItems.filter((f) => dnVal(f.sizeDn) === bdv);
      const bValves = valveItems.filter((v) => dnVal(v.sizeDn) === bdv);
      const seq: SeqNode[] = [];
      const junc = bFits.find((f) => /COUPLING|TEE|SOCKOLET|WELDOLET/i.test(f.description));
      if (junc) {
        seq.push({
          itemNo: junc.itemNo,
          desc: junc.description,
          dan: junc.danCode,
          sizeDn: junc.sizeDn,
          thk: parseThk(junc.description),
        });
      }
      seq.push({
        itemNo: bp.itemNo,
        desc: bp.description,
        dan: bp.danCode,
        sizeDn: bp.sizeDn,
        thk: parseThk(bp.description),
      });
      if (bValves[0]) {
        seq.push({
          itemNo: bValves[0].itemNo,
          desc: bValves[0].description,
          dan: bValves[0].danCode,
          sizeDn: bValves[0].sizeDn,
          thk: parseThk(bValves[0].description),
        });
      }
      for (let i = 0; i < seq.length - 1; i++) {
        joints.push(
          this.createJoint(
            seq[i],
            seq[i + 1],
            lineNo,
            revNo,
            page.sheetNo,
            jno,
            anchorByJoint.get(jno),
          ),
        );
        jno++;
      }
    }

    return joints;
  }

  public createStampsFromWeldLog(
    welds: WeldJoint[],
    pageHeight: number,
    vectorSegments: readonly VectorSegment2D[] = [],
    vectorSnaps: readonly SnapPoint[] = [],
  ): WeldStampEntity[] {
    const stamps: WeldStampEntity[] = [];
    for (const w of welds) {
      if (!w.anchorWorld) continue;
      const pageNum = Number.parseInt(w.sheetNo, 10) || 1;
      const isField = w.item1 === '-' || w.item2 === '-';
      const anchorPt = this.snapWeldAnchorToPipeLine(w.anchorWorld, vectorSegments, vectorSnaps);

      const dx = w.anchorWorld.x - anchorPt.x;
      const dy = w.anchorWorld.y - anchorPt.y;
      const dist = Math.hypot(dx, dy);
      const offsetY = anchorPt.y > pageHeight * 0.5 ? -44 : 44;
      const center: Point2D =
        dist > 4
          ? {
              x: anchorPt.x + (dx / dist) * Math.max(48, dist + 24),
              y: anchorPt.y + (dy / dist) * Math.max(48, dist + 24),
            }
          : { x: anchorPt.x + 38, y: anchorPt.y + offsetY };

      stamps.push(
        new WeldStampEntity({
          id: `auto-J-${w.jointNo}`,
          shapeKind: isField ? 'triangle' : 'circle',
          center,
          width: 34,
          height: 34,
          leaderAnchor: anchorPt,
          hasLeader: true,
          jointNo: String(w.jointNo),
          pageNumber: pageNum,
          jointMeta: {
            typeOfJoint: isField ? 'F' : 'S',
            jointNo: String(w.jointNo),
            drawJointNo: `${isField ? 'F' : 'S'}${w.jointNo}`,
            member1: w.desc1,
            member2: w.desc2,
            dia1: w.size1Mm,
            dia2: w.size2Mm,
            nps1: w.size1Inch,
            nps2: w.size2Inch,
            thickness1: w.thk1Mm,
            thickness2: w.thk2Mm,
            danCode1: w.danCode1,
            danCode2: w.danCode2,
          },
        }),
      );
    }
    return stamps;
  }

  /**
   * Resolves a weld callout number's text position onto the actual pipe line weld point
   * by following the PDF's leader segment or snapping to nearby pipe vector geometry.
   */
  private snapWeldAnchorToPipeLine(
    numberPos: Point2D,
    segments: readonly VectorSegment2D[],
    snaps: readonly SnapPoint[],
  ): Point2D {
    if (segments.length > 0) {
      let bestFarPt: Point2D | null = null;
      let bestScore = Infinity;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segLen = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y);
        if (segLen < 6 || segLen > 80) continue;

        const d1 = Math.hypot(seg.p1.x - numberPos.x, seg.p1.y - numberPos.y);
        const d2 = Math.hypot(seg.p2.x - numberPos.x, seg.p2.y - numberPos.y);
        const nearDist = Math.min(d1, d2);
        const farDist = Math.max(d1, d2);
        if (nearDist > 14 || farDist < 9 || farDist > 80) continue;

        const farPt = d1 <= d2 ? seg.p2 : seg.p1;

        // Prefer leader endpoints that land directly on another pipe segment
        let touchesPipe = false;
        for (let j = 0; j < segments.length; j++) {
          if (i === j) continue;
          const other = segments[j];
          const otherLen = Math.hypot(other.p2.x - other.p1.x, other.p2.y - other.p1.y);
          if (otherLen < 10) continue;
          if (distancePointToSegment(farPt, other.p1, other.p2).distance <= 2.5) {
            touchesPipe = true;
            break;
          }
        }

        const score = nearDist - (touchesPipe ? 20 : 0);
        if (score < bestScore) {
          bestScore = score;
          bestFarPt = farPt;
        }
      }

      if (bestFarPt) {
        return { ...bestFarPt };
      }

      // Fallback: project onto nearest long pipe segment within 45pt
      let bestProj: Point2D | null = null;
      let bestProjDist = 45;
      for (const seg of segments) {
        const segLen = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y);
        if (segLen < 15) continue;
        const res = distancePointToSegment(numberPos, seg.p1, seg.p2);
        if (res.distance > 4 && res.distance < bestProjDist) {
          bestProjDist = res.distance;
          bestProj = res.closest;
        }
      }
      if (bestProj) {
        return { ...bestProj };
      }
    }

    // Secondary fallback: nearest END snap point outside the number's own circle
    let bestSnap: Point2D | null = null;
    let bestSnapDist = 55;
    for (const sp of snaps) {
      if (sp.kind !== 'END') continue;
      const d = Math.hypot(sp.point.x - numberPos.x, sp.point.y - numberPos.y);
      if (d >= 9 && d < bestSnapDist) {
        bestSnapDist = d;
        bestSnap = sp.point;
      }
    }

    return bestSnap ? { ...bestSnap } : { ...numberPos };
  }

  private expandFittings(fittings: MTOItem[]) {
    const pool: Array<SeqNode & { is45: boolean; is90: boolean }> = [];
    for (const f of fittings) {
      const cnt = Math.max(1, Number.parseInt(f.qty.replace(/[MmFtADT]/g, '') || '1', 10) || 1);
      for (let i = 0; i < cnt; i++) {
        pool.push({
          itemNo: f.itemNo,
          desc: f.description,
          dan: f.danCode,
          sizeDn: f.sizeDn,
          thk: parseThk(f.description),
          is45: f.description.includes('45'),
          is90: f.description.includes('90'),
        });
      }
    }
    return pool;
  }

  private find45Positions(text: string): Set<number> {
    const pos = new Set<number>();
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (/45[o°]/i.test(lines[i])) {
        const ctx = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
        let mm: RegExpExecArray | null;
        const pat = /<(\d+)>/g;
        while ((mm = pat.exec(ctx)) !== null) {
          pos.add(Number.parseInt(mm[1], 10));
        }
      }
    }
    return pos;
  }

  private createJoint(
    L: SeqNode,
    R: SeqNode,
    lineNo: string,
    revNo: string,
    sheetNo: string,
    jno: number,
    anchorWorld?: { x: number; y: number },
  ): WeldJoint {
    return {
      lineNo,
      jointNo: jno,
      revNo,
      sheetNo,
      item1: L.itemNo,
      desc1: L.desc.slice(0, 60),
      danCode1: L.dan,
      size1Dn: L.sizeDn,
      size1Mm: L.sizeDn,
      size1Inch: dnToInch(L.sizeDn),
      thk1Mm: L.thk,
      item2: R.itemNo,
      desc2: R.desc.slice(0, 60),
      danCode2: R.dan,
      size2Dn: R.sizeDn,
      size2Mm: R.sizeDn,
      size2Inch: dnToInch(R.sizeDn),
      thk2Mm: R.thk,
      anchorWorld,
    };
  }
}
