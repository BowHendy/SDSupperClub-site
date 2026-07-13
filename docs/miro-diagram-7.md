# Miro Diagram 7 — Fill milestones (T−14 / T−7)

Push this to [Supper Collective flows](https://miro.com/app/board/uXjVHI1dVnI=/) when MCP board access is allowed (board classification must permit MCP).

**Title:** `Supper Collective - Fill milestones T-14 / T-7 (updated)`  
**Position:** y ≈ 12000 (below diagram 6)

## DSL (flowchart)

```
graphdir TD
palette #fff6b6 #c6dcff #adf0c7

n1 Meal LIVE collecting paid seats flowchart-process 0
n2 T-14 more than 8 paid flowchart-decision 1
n3 On track 9 to 10 flowchart-process 0
n4 Warning email host flowchart-process 0
n5 Host pays subsidy flowchart-decision 1
n6 Pot equals 10 seats flowchart-process 0
n7 Open until T-7 or cancel flowchart-process 0
n8 More guests pay later flowchart-decision 1
n9 Refund host filled seats flowchart-process 0
n10 T-7 subsidy OK flowchart-decision 1
n11 Auto 50pct ingredient to chef flowchart-process 0
n12 Auto-cancel guest refunds flowchart-process 0
n13 Dinner plus remainder payout flowchart-terminator 2

c n1 - n2
c n2 yes 9 to 10 n3
c n2 no 8 or fewer n4
c n4 - n5
c n5 yes n6
c n5 no n7
c n6 - n8
c n8 yes n9
c n3 - n10
c n6 - n10
c n7 - n10
c n10 yes n11
c n10 no n12
c n11 - n13
```

## Locked rules reflected

- **EC2:** Warning at ≤8 paid (not only &lt;8)
- **EC4:** Meal only public after T−30 dual confirm (upstream of this diagram)
- **EC5:** Auto-cancel → full guest refunds; late host cancel stricter
