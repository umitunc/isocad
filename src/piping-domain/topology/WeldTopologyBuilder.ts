import { WeldStampEntity } from '../../core/entities/WeldStampEntity';
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

  public createStampsFromWeldLog(welds: WeldJoint[], pageHeight: number): WeldStampEntity[] {
    const stamps: WeldStampEntity[] = [];
    for (const w of welds) {
      if (!w.anchorWorld) continue;
      const pageNum = Number.parseInt(w.sheetNo, 10) || 1;
      const isField = w.item1 === '-' || w.item2 === '-';
      const offsetY = w.anchorWorld.y > pageHeight * 0.5 ? -44 : 44;
      stamps.push(
        new WeldStampEntity({
          id: `auto-J-${w.jointNo}`,
          shapeKind: isField ? 'triangle' : 'circle',
          center: { x: w.anchorWorld.x + 38, y: w.anchorWorld.y + offsetY },
          width: 34,
          height: 34,
          leaderAnchor: w.anchorWorld,
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
