import streamlit as st


BASE_SCORES = {
    'u': 1.2, # o->x
    'd': 1.1, # x->o
    'k': 1.0  # keep
}

WEIGHT_MAP = {
    ('k', 'k'): (1.0, 1.0),
    ('k', 'u'): (1.0, 1.0),
    ('k', 'd'): (1.0, 1.0),
    ('u', 'k'): (1.0, 1.5),
    ('d', 'k'): (1.0, 1.5),
    ('u', 'u'): (1.5, 1.5),
    ('d', 'd'): (1.5, 1.5),
    ('u', 'd'): (0.5, 1),
    ('d', 'u'): (0.5, 1),
}

FATIGUE_C = 1.5
C_STRAIN = 0.005

def get_torque_symbol(prev_val, curr_val):
    if prev_val == 'x' and curr_val == 'o': return 'd'
    elif prev_val == 'o' and curr_val == 'x': return 'u'
    else: return 'k'

def calculate_memory_weight(s, c_val):
    if len(s) < 2:
        return [1.0] * len(s)
    pairs = [s[i:i+2] for i in range(0, len(s)-1, 2)]
    flop = []
    cnotes = []
    for p in pairs:
        flop.insert(0, p)
        found_index = -1
        for j in range(1, len(flop)):
            if flop[j] == p:
                found_index = j
                break
        if found_index != -1:
            flop = flop[:found_index]
        stack_depth = len(flop)
        weight = 1.0 * (c_val ** (stack_depth - 1))
        cnotes.append(weight)
    return cnotes

def calculate_taiko_complexity(s, c_strain=C_STRAIN):
    n = len(s)
    if n < 2: return 0.0, 0.0
    r_seq = list(s[0::2])
    l_seq = list(s[1::2])
    
    fl = ['k']
    for i in range(1, len(l_seq)):
        fl.append(get_torque_symbol(l_seq[i-1], l_seq[i]))
        
    fr = []
    for i in range(len(r_seq) - 1):
        fr.append(get_torque_symbol(r_seq[i], r_seq[i+1]))
    
    if n % 2 == 0: fr.append('k')
    if len(fr) > len(fl): fl.append('k')

    cnotes = calculate_memory_weight(s, FATIGUE_C)
    min_len = min(len(fl), len(fr), len(cnotes))

    total_complexity = 0.0
    for i in range(min_len):
        sym_l = fl[i]
        sym_r = fr[i]
        note_weight = cnotes[i]
        base_l = BASE_SCORES.get(sym_l, 1.0)
        base_r = BASE_SCORES.get(sym_r, 1.0)
        hand_weights = WEIGHT_MAP.get((sym_l, sym_r), (1.0, 1.0))
        cli, cri = hand_weights
        weight_strain = 1 + c_strain * i
        node_score = (base_l * cli + base_r * cri) * note_weight * weight_strain
        total_complexity += node_score
        
    avg_complexity = total_complexity / n
    return total_complexity, avg_complexity

def inject_custom_css():
    st.markdown("""
    <style>
        /* 强制深色背景 */
        .stApp {
            background-color: #0e1117;
            color: #fafafa;
        }


        .main .block-container {
            max-width: 95% !important; 
            padding-top: 2rem;
            padding-right: 1rem;
            padding-left: 1rem;
            padding-bottom: 2rem;
            display: flex;
            align-items: center;
        }
    
        .taiko-container-wrapper {
            width: 100%;
            min-width: 1280px;  
            background-color: #1c1c1c;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 10px 0;
            margin-bottom: 20px;

            overflow-x: auto; 
        }
        .taiko-track {
            display: flex;
            flex-direction: row;
            min-width: 100%; 
            width: fit-content;
            overflow-x: hidden; 
            padding-left: 20px;
            padding-right: 20px;
            height: 90px;
            align-items: center;
        }


        .note {
            width: 80px;
            height: 80px;
            min-width: 80px;
            border-radius: 50%;
            border: 4px solid #fff;
            box-sizing: border-box;
            margin-right: 0px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-family: sans-serif;
            font-size: 24px;
            color: rgba(255,255,255,0.8);
            position: relative;
        }
        
        .note.don {
            background: radial-gradient(circle at 30% 30%, #ff5e5e, #d60000);
            box-shadow: inset 0 0 10px rgba(0,0,0,0.3);
        }

        .note.ka {
            background: radial-gradient(circle at 30% 30%, #5e9eff, #0056d6);
            box-shadow: inset 0 0 10px rgba(0,0,0,0.3);
        }
        
        .note.unknown {
            background-color: #333;
            border-color: #555;
            color: #888;
        }

        div[data-testid="stMetricValue"] {
            font-size: 42px;
            color: #ffbd45;
        }

        .stTextInput input {
            font-family: monospace;
            font-size: 1.2rem;
        }
    </style>
    """, unsafe_allow_html=True)



def main():

    st.set_page_config(page_title="Taiko Complexity", layout="wide")
    
    inject_custom_css()

    st.title("🐟️鱼蛋复杂度计算器")
    

    pattern_input = st.text_input(
        "输入由 o,x 组成的鱼蛋序列 (o = Don, x = Ka)，回车键开始计算", 
        value="ooxxooxxooxxooxx", 
        help="输入谱面序列"
    ).lower().strip()

    clean_pattern = "".join([c for c in pattern_input if c in ['o', 'x']])

    # --- 预览框 (Top 1/3) ---
    notes_html = ""
    for char in pattern_input:
        if char == 'o':
            notes_html += '<div class="note don"></div>'
        elif char == 'x':
            notes_html += '<div class="note ka"></div>'
        elif char.strip() == '':
            continue
        else:
            notes_html += f'<div class="note unknown">?</div>'

    # 生成 HTML
    html_block = f"""
    <div class="taiko-container-wrapper">
        <div class="taiko-track">
            {notes_html}
        </div>
    </div>
    """
    
    st.markdown("### 预览")

    st.markdown(html_block, unsafe_allow_html=True)

    st.markdown("---")

    total_score, avg_score = calculate_taiko_complexity(clean_pattern)

    _, c1, c2, c3, _ = st.columns([1, 2, 2, 2, 1])
    
    with c1:

        st.metric(label="总复杂度", value=f"{total_score:.2f}")
    with c2:
        st.metric(label="音符平均复杂度", value=f"{avg_score:.3f}")
    with c3:
        st.info(f"音符个数: {len(clean_pattern)}")


if __name__ == "__main__":
    main()